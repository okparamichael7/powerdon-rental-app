// TCP Proxy Server for WsCharge Station Connections
// This runs as a separate Node.js process and bridges TCP connections to the HTTP API

import * as net from 'net';
import * as http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { WsChargeProtocol, MessageType } from '../lib/wscharge/proxy-protocol';

// Configuration
const config = {
  // TCP server settings
  tcp: {
    port: parseInt(process.env.TCP_PORT || '8088', 10),
    host: process.env.TCP_HOST || '0.0.0.0',
    keepAliveInitialDelay: 30000, // 30 seconds
    timeout: 180000, // 3 minutes
  },
  // HTTP API settings
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    authToken: process.env.API_AUTH_TOKEN || '',
  },
  // WebSocket server for real-time updates
  ws: {
    port: parseInt(process.env.WS_PORT || '8089', 10),
    path: '/ws',
  },
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};

// Logger
const log = {
  debug: (...args: unknown[]) => config.logLevel === 'debug' && console.log('[DEBUG]', new Date().toISOString(), ...args),
  info: (...args: unknown[]) => ['debug', 'info'].includes(config.logLevel) && console.log('[INFO]', new Date().toISOString(), ...args),
  warn: (...args: unknown[]) => ['debug', 'info', 'warn'].includes(config.logLevel) && console.warn('[WARN]', new Date().toISOString(), ...args),
  error: (...args: unknown[]) => console.error('[ERROR]', new Date().toISOString(), ...args),
};

// Connection tracking
interface StationConnection {
  socket: net.Socket;
  stationId: string | null;
  externalId: string | null;
  connectedAt: Date;
  lastActivity: Date;
  remoteAddress: string;
  bytesReceived: number;
  bytesSent: number;
  messagesReceived: number;
  messagesSent: number;
  buffer: Buffer;
}

const connections = new Map<string, StationConnection>();
const stationIdToConnectionId = new Map<string, string>();

// WebSocket clients for real-time updates
const wsClients = new Set<WebSocket>();

// Broadcast to all WebSocket clients
function broadcast(event: string, data: unknown) {
  const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Send message to HTTP API
async function sendToApi(endpoint: string, data: unknown): Promise<unknown> {
  const url = `${config.api.baseUrl}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api.authToken}`,
        'X-Station-Proxy': 'true',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    return response.json();
  } catch (error) {
    log.error('API request failed:', endpoint, error);
    throw error;
  }
}

// Process incoming message from station
async function processMessage(conn: StationConnection, message: Buffer): Promise<Buffer | null> {
  const startTime = Date.now();
  
  try {
    const decoded = WsChargeProtocol.decode(message);
    log.debug('Received message:', decoded.type, 'from', conn.externalId || 'unknown');

    // Log raw event
    await sendToApi('/api/stations/message', {
      direction: 'inbound',
      stationExternalId: conn.externalId,
      stationId: conn.stationId,
      eventType: decoded.type,
      rawData: message.toString('base64'),
      parsedData: decoded,
      remoteAddress: conn.remoteAddress,
    }).catch(err => log.warn('Failed to log event:', err.message));

    let response: Buffer | null = null;

    switch (decoded.type) {
      case 'login': {
        // Station login - register the connection
        conn.externalId = decoded.data.stationId;
        
        // Send to API to register/update station
        const result = await sendToApi('/api/stations/message', {
          type: 'login',
          stationExternalId: decoded.data.stationId,
          data: {
            iccid: decoded.data.iccid,
            firmwareVersion: decoded.data.firmwareVersion,
            slots: decoded.data.slots,
          },
          remoteAddress: conn.remoteAddress,
        }) as { stationId?: string };

        if (result.stationId) {
          conn.stationId = result.stationId;
          stationIdToConnectionId.set(result.stationId, conn.socket.remoteAddress + ':' + conn.socket.remotePort);
        }

        // Send login response
        response = WsChargeProtocol.encode({
          type: 'login_response',
          data: { success: true, timestamp: new Date() },
        });

        broadcast('station_connected', {
          stationId: conn.stationId,
          externalId: conn.externalId,
          remoteAddress: conn.remoteAddress,
        });

        log.info('Station logged in:', conn.externalId, 'ID:', conn.stationId);
        break;
      }

      case 'heartbeat': {
        // Update heartbeat in API
        if (conn.stationId) {
          await sendToApi('/api/stations/message', {
            type: 'heartbeat',
            stationId: conn.stationId,
            data: decoded.data,
          }).catch(err => log.warn('Failed to update heartbeat:', err.message));
        }

        // Send heartbeat response
        response = WsChargeProtocol.encode({
          type: 'heartbeat_response',
          data: { timestamp: new Date() },
        });
        break;
      }

      case 'inventory_report': {
        // Station reporting its inventory
        if (conn.stationId) {
          await sendToApi('/api/stations/message', {
            type: 'inventory_report',
            stationId: conn.stationId,
            data: decoded.data,
          });

          broadcast('inventory_updated', {
            stationId: conn.stationId,
            slots: decoded.data.slots,
          });
        }

        // Send acknowledgment
        response = WsChargeProtocol.encode({
          type: 'inventory_response',
          data: { success: true },
        });
        break;
      }

      case 'borrow_result': {
        // Station reporting borrow (unlock) result
        if (conn.stationId) {
          const result = await sendToApi('/api/stations/message', {
            type: 'borrow_result',
            stationId: conn.stationId,
            data: decoded.data,
          }) as { success: boolean };

          broadcast('unlock_result', {
            stationId: conn.stationId,
            slotNumber: decoded.data.slotNumber,
            success: decoded.data.success,
            powerBankId: decoded.data.powerBankId,
          });
        }
        // No response needed for results
        break;
      }

      case 'return_detected': {
        // Station detected a power bank return
        if (conn.stationId) {
          const result = await sendToApi('/api/stations/message', {
            type: 'return_detected',
            stationId: conn.stationId,
            data: decoded.data,
          });

          broadcast('return_detected', {
            stationId: conn.stationId,
            slotNumber: decoded.data.slotNumber,
            powerBankId: decoded.data.powerBankId,
            batteryLevel: decoded.data.batteryLevel,
          });
        }

        // Send acknowledgment
        response = WsChargeProtocol.encode({
          type: 'return_response',
          data: { success: true },
        });
        break;
      }

      case 'error': {
        log.error('Station error:', conn.externalId, decoded.data);
        
        if (conn.stationId) {
          await sendToApi('/api/stations/message', {
            type: 'error',
            stationId: conn.stationId,
            data: decoded.data,
          }).catch(err => log.warn('Failed to log error:', err.message));

          broadcast('station_error', {
            stationId: conn.stationId,
            errorCode: decoded.data.code,
            errorMessage: decoded.data.message,
          });
        }
        break;
      }

      default:
        log.warn('Unknown message type:', decoded.type);
    }

    const processingTime = Date.now() - startTime;
    log.debug('Message processed in', processingTime, 'ms');

    return response;
  } catch (error) {
    log.error('Error processing message:', error);
    return null;
  }
}

// Send command to station
async function sendCommand(stationId: string, command: Buffer): Promise<boolean> {
  const connectionId = stationIdToConnectionId.get(stationId);
  if (!connectionId) {
    log.warn('No connection found for station:', stationId);
    return false;
  }

  const conn = connections.get(connectionId);
  if (!conn || !conn.socket || conn.socket.destroyed) {
    log.warn('Connection not available for station:', stationId);
    stationIdToConnectionId.delete(stationId);
    return false;
  }

  return new Promise((resolve) => {
    conn.socket.write(command, (err) => {
      if (err) {
        log.error('Failed to send command:', err.message);
        resolve(false);
      } else {
        conn.bytesSent += command.length;
        conn.messagesSent++;
        conn.lastActivity = new Date();
        log.debug('Command sent to station:', stationId, command.length, 'bytes');
        resolve(true);
      }
    });
  });
}

// Handle new TCP connection
function handleConnection(socket: net.Socket) {
  const connectionId = `${socket.remoteAddress}:${socket.remotePort}`;
  
  log.info('New connection from:', connectionId);

  const conn: StationConnection = {
    socket,
    stationId: null,
    externalId: null,
    connectedAt: new Date(),
    lastActivity: new Date(),
    remoteAddress: socket.remoteAddress || 'unknown',
    bytesReceived: 0,
    bytesSent: 0,
    messagesReceived: 0,
    messagesSent: 0,
    buffer: Buffer.alloc(0),
  };

  connections.set(connectionId, conn);

  // Configure socket
  socket.setKeepAlive(true, config.tcp.keepAliveInitialDelay);
  socket.setTimeout(config.tcp.timeout);

  // Handle incoming data
  socket.on('data', async (data: Buffer) => {
    conn.buffer = Buffer.concat([conn.buffer, data]);
    conn.bytesReceived += data.length;
    conn.lastActivity = new Date();

    // Try to extract complete messages from buffer
    while (conn.buffer.length > 0) {
      // Check for start bytes (0x68 0x65)
      const startIndex = conn.buffer.indexOf(Buffer.from([0x68, 0x65]));
      if (startIndex === -1) {
        // No valid message start found, clear buffer
        conn.buffer = Buffer.alloc(0);
        break;
      }

      // Remove any garbage before start bytes
      if (startIndex > 0) {
        conn.buffer = conn.buffer.slice(startIndex);
      }

      // Need at least 8 bytes for header + length
      if (conn.buffer.length < 8) {
        break;
      }

      // Read message length from header
      const messageLength = conn.buffer.readUInt16BE(4) + 10; // +10 for header, checksum, and end bytes

      // Check if we have the complete message
      if (conn.buffer.length < messageLength) {
        break;
      }

      // Extract complete message
      const message = conn.buffer.slice(0, messageLength);
      conn.buffer = conn.buffer.slice(messageLength);
      conn.messagesReceived++;

      // Process message
      const response = await processMessage(conn, message);
      
      if (response) {
        socket.write(response, (err) => {
          if (err) {
            log.error('Failed to send response:', err.message);
          } else {
            conn.bytesSent += response.length;
            conn.messagesSent++;
          }
        });
      }
    }
  });

  // Handle socket timeout
  socket.on('timeout', () => {
    log.warn('Connection timeout:', connectionId, conn.externalId);
    socket.end();
  });

  // Handle socket error
  socket.on('error', (err: Error) => {
    log.error('Socket error:', connectionId, err.message);
  });

  // Handle connection close
  socket.on('close', () => {
    log.info('Connection closed:', connectionId, conn.externalId);
    
    if (conn.stationId) {
      stationIdToConnectionId.delete(conn.stationId);
      
      // Notify API that station disconnected
      sendToApi('/api/stations/message', {
        type: 'disconnect',
        stationId: conn.stationId,
      }).catch(err => log.warn('Failed to notify disconnect:', err.message));

      broadcast('station_disconnected', {
        stationId: conn.stationId,
        externalId: conn.externalId,
      });
    }

    connections.delete(connectionId);
  });
}

// Create TCP server
const tcpServer = net.createServer(handleConnection);

tcpServer.on('error', (err: Error) => {
  log.error('TCP server error:', err.message);
});

tcpServer.on('listening', () => {
  const addr = tcpServer.address();
  log.info('TCP server listening on:', addr);
});

// Create HTTP server for command API and health checks
const httpServer = http.createServer((req, res) => {
  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      connections: connections.size,
      stations: stationIdToConnectionId.size,
      uptime: process.uptime(),
    }));
    return;
  }

  // Get connected stations
  if (req.url === '/stations' && req.method === 'GET') {
    const stations = Array.from(connections.values())
      .filter(c => c.stationId)
      .map(c => ({
        stationId: c.stationId,
        externalId: c.externalId,
        remoteAddress: c.remoteAddress,
        connectedAt: c.connectedAt,
        lastActivity: c.lastActivity,
        bytesReceived: c.bytesReceived,
        bytesSent: c.bytesSent,
        messagesReceived: c.messagesReceived,
        messagesSent: c.messagesSent,
      }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stations));
    return;
  }

  // Send command to station
  if (req.url?.startsWith('/command/') && req.method === 'POST') {
    const stationId = req.url.split('/')[2];
    
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { type, slotNumber, payload } = JSON.parse(body);
        
        // Encode command
        const command = WsChargeProtocol.encode({
          type,
          data: { slotNumber, ...payload },
        });

        const success = await sendCommand(stationId, command);

        res.writeHead(success ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
    return;
  }

  // 404 for other routes
  res.writeHead(404);
  res.end('Not Found');
});

// Create WebSocket server for real-time updates
const wss = new WebSocketServer({ server: httpServer, path: config.ws.path });

wss.on('connection', (ws: WebSocket) => {
  log.info('WebSocket client connected');
  wsClients.add(ws);

  // Send current state
  ws.send(JSON.stringify({
    event: 'connected',
    data: {
      stations: Array.from(connections.values())
        .filter(c => c.stationId)
        .map(c => ({
          stationId: c.stationId,
          externalId: c.externalId,
          connectedAt: c.connectedAt,
        })),
    },
    timestamp: new Date().toISOString(),
  }));

  ws.on('close', () => {
    log.info('WebSocket client disconnected');
    wsClients.delete(ws);
  });

  ws.on('error', (err) => {
    log.error('WebSocket error:', err.message);
    wsClients.delete(ws);
  });
});

// Cleanup stale connections periodically
setInterval(() => {
  const now = Date.now();
  const timeout = config.tcp.timeout;

  connections.forEach((conn, id) => {
    if (now - conn.lastActivity.getTime() > timeout) {
      log.warn('Closing stale connection:', id, conn.externalId);
      conn.socket.destroy();
      connections.delete(id);
      if (conn.stationId) {
        stationIdToConnectionId.delete(conn.stationId);
      }
    }
  });
}, 60000); // Check every minute

// Start servers
tcpServer.listen(config.tcp.port, config.tcp.host);
httpServer.listen(config.ws.port, () => {
  log.info('HTTP/WebSocket server listening on port:', config.ws.port);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log.info('Received SIGTERM, shutting down...');
  
  tcpServer.close();
  httpServer.close();
  wss.close();
  
  connections.forEach((conn) => {
    conn.socket.end();
  });

  setTimeout(() => {
    process.exit(0);
  }, 5000);
});

process.on('SIGINT', () => {
  log.info('Received SIGINT, shutting down...');
  process.exit(0);
});

log.info('TCP Proxy Server starting...');
log.info('Config:', {
  tcp: { port: config.tcp.port, host: config.tcp.host },
  api: { baseUrl: config.api.baseUrl },
  ws: { port: config.ws.port },
});

export { sendCommand, connections, stationIdToConnectionId };
