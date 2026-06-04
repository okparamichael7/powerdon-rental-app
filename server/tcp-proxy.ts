/**
 * WsCharge v5.8P TCP bridge — forwards binary frames to Next.js /api/stations/message
 * Run: npx tsx server/tcp-proxy.ts
 */

import * as net from 'net'
import * as http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { PROTOCOL_TOKEN } from '../lib/wscharge/protocol.js'

const config = {
  tcp: {
    port: parseInt(process.env.TCP_PORT || '8088', 10),
    host: process.env.TCP_HOST || '0.0.0.0',
    keepAliveInitialDelay: 30_000,
    timeout: 180_000,
  },
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    authToken:
      process.env.API_AUTH_TOKEN ||
      process.env.STATION_PROXY_TOKEN ||
      process.env.TCP_PROXY_API_KEY ||
      '',
  },
  ws: {
    port: parseInt(process.env.WS_PORT || '8089', 10),
    path: '/ws',
  },
  reconnectBackoffMs: parseInt(process.env.TCP_PROXY_BACKOFF_MS || '1000', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
}

const log = {
  debug: (...args: unknown[]) =>
    config.logLevel === 'debug' && console.log('[DEBUG]', new Date().toISOString(), ...args),
  info: (...args: unknown[]) =>
    ['debug', 'info'].includes(config.logLevel) &&
    console.log('[INFO]', new Date().toISOString(), ...args),
  warn: (...args: unknown[]) => console.warn('[WARN]', new Date().toISOString(), ...args),
  error: (...args: unknown[]) => console.error('[ERROR]', new Date().toISOString(), ...args),
}

interface StationConnection {
  socket: net.Socket
  connectionId: string
  stationId: string | null
  externalId: string | null
  connectedAt: Date
  lastActivity: Date
  remoteAddress: string
  bytesReceived: number
  bytesSent: number
  messagesReceived: number
  messagesSent: number
  buffer: Buffer
}

const connections = new Map<string, StationConnection>()
const externalIdToConnectionId = new Map<string, string>()
const wsClients = new Set<WebSocket>()

function broadcast(event: string, data: unknown) {
  const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() })
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) client.send(message)
  }
}

async function apiPost(path: string, body: unknown): Promise<Record<string, unknown>> {
  const url = `${config.api.baseUrl}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Station-Proxy': 'true',
  }
  if (config.api.authToken) {
    headers.Authorization = `Bearer ${config.api.authToken}`
  }

  let attempt = 0
  while (attempt < 3) {
    attempt++
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) {
        const text = await response.text()
        if (response.status >= 500 && attempt < 3) {
          await new Promise((r) =>
            setTimeout(r, config.reconnectBackoffMs * 2 ** (attempt - 1) + Math.random() * 100)
          )
          continue
        }
        throw new Error(`API ${response.status}: ${text}`)
      }
      return (await response.json()) as Record<string, unknown>
    } catch (err) {
      if (attempt >= 3) throw err
      await new Promise((r) =>
        setTimeout(r, config.reconnectBackoffMs * 2 ** (attempt - 1) + Math.random() * 100)
      )
    }
  }
  throw new Error('API request failed after retries')
}

async function processFrame(conn: StationConnection, frame: Buffer): Promise<void> {
  const messageHex = frame.toString('hex')
  const correlationId = `${conn.connectionId}-${Date.now()}`

  const result = await apiPost('/api/stations/message', {
    messageHex,
    stationId: conn.externalId ?? undefined,
    connectionId: conn.connectionId,
    remoteAddress: conn.remoteAddress,
    correlationId,
  })

  if (result.stationId && typeof result.stationId === 'string') {
    conn.externalId = result.stationId
    externalIdToConnectionId.set(result.stationId, conn.connectionId)
    broadcast('station_connected', {
      externalId: conn.externalId,
      connectionId: conn.connectionId,
    })
  }

  const responses = result.responses as Array<{ responseHex?: string }> | undefined
  if (responses?.length) {
    for (const item of responses) {
      if (item.responseHex) {
        const out = Buffer.from(item.responseHex, 'hex')
        await new Promise<void>((resolve, reject) => {
          conn.socket.write(out, (err) => (err ? reject(err) : resolve()))
        })
        conn.bytesSent += out.length
        conn.messagesSent++
      }
    }
  }
}

async function handleIncomingData(conn: StationConnection, data: Buffer): Promise<void> {
  conn.buffer = Buffer.concat([conn.buffer, data])
  conn.bytesReceived += data.length
  conn.lastActivity = new Date()

  let offset = 0
  while (offset + 2 <= conn.buffer.length) {
    const packetLength = conn.buffer.readUInt16BE(offset)
    const totalLength = 2 + packetLength
    if (offset + totalLength > conn.buffer.length) break

    const frame = conn.buffer.subarray(offset, offset + totalLength)
    offset += totalLength

    if (frame.length >= 9 && frame.readUInt32BE(5) !== PROTOCOL_TOKEN) {
      log.warn('Invalid protocol token from', conn.connectionId)
      continue
    }

    conn.messagesReceived++

    try {
      await processFrame(conn, frame)
    } catch (err) {
      log.error('Frame processing failed:', err instanceof Error ? err.message : err)
    }
  }
  conn.buffer = conn.buffer.subarray(offset)
}

function handleConnection(socket: net.Socket) {
  const connectionId = `${socket.remoteAddress}:${socket.remotePort}`
  log.info('New TCP connection:', connectionId)

  const conn: StationConnection = {
    socket,
    connectionId,
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
  }

  connections.set(connectionId, conn)
  socket.setKeepAlive(true, config.tcp.keepAliveInitialDelay)
  socket.setTimeout(config.tcp.timeout)

  socket.on('data', (chunk) => {
    void handleIncomingData(conn, chunk)
  })

  socket.on('timeout', () => {
    log.warn('Socket timeout:', connectionId)
    socket.end()
  })

  socket.on('error', (err) => log.error('Socket error:', connectionId, err.message))

  socket.on('close', () => {
    log.info('Connection closed:', connectionId, conn.externalId)
    if (conn.externalId) {
      externalIdToConnectionId.delete(conn.externalId)
      void apiPost('/api/stations/disconnect', { externalId: conn.externalId }).catch((e) =>
        log.warn('Disconnect notify failed:', e.message)
      )
      broadcast('station_disconnected', { externalId: conn.externalId })
    }
    connections.delete(connectionId)
  })
}

const tcpServer = net.createServer(handleConnection)

tcpServer.on('listening', () => log.info('WsCharge TCP proxy listening:', tcpServer.address()))

const httpServer = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        status: 'healthy',
        protocol: 'WsCharge v5.8P',
        connections: connections.size,
        stations: externalIdToConnectionId.size,
        uptime: process.uptime(),
      })
    )
    return
  }

  if (req.url?.startsWith('/command/') && req.method === 'POST') {
    const externalId = decodeURIComponent(req.url.split('/')[2] || '')
    const connId = externalIdToConnectionId.get(externalId)
    const conn = connId ? connections.get(connId) : undefined

    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try {
        const { commandHex } = JSON.parse(body) as { commandHex?: string }
        if (!commandHex || !conn?.socket || conn.socket.destroyed) {
          res.writeHead(503, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Station not connected' }))
          return
        }
        const out = Buffer.from(commandHex, 'hex')
        conn.socket.write(out, (err) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: false, error: err.message }))
            return
          }
          conn.bytesSent += out.length
          conn.messagesSent++
          conn.lastActivity = new Date()
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true, bytes: out.length }))
        })
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON body' }))
      }
    })
    return
  }

  if (req.url === '/stations' && req.method === 'GET') {
    const list = [...connections.values()]
      .filter((c) => c.externalId)
      .map((c) => ({
        externalId: c.externalId,
        connectionId: c.connectionId,
        remoteAddress: c.remoteAddress,
        connectedAt: c.connectedAt,
        lastActivity: c.lastActivity,
        bytesReceived: c.bytesReceived,
        bytesSent: c.bytesSent,
      }))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(list))
    return
  }

  res.writeHead(404)
  res.end('Not Found')
})

const wss = new WebSocketServer({ server: httpServer, path: config.ws.path })

wss.on('connection', (ws) => {
  wsClients.add(ws)
  ws.on('close', () => wsClients.delete(ws))
})

tcpServer.listen(config.tcp.port, config.tcp.host)
httpServer.listen(config.ws.port, () => log.info('HTTP/WS on port', config.ws.port))

process.on('SIGTERM', () => {
  tcpServer.close()
  httpServer.close()
  for (const c of connections.values()) c.socket.end()
  setTimeout(() => process.exit(0), 3000)
})

log.info('WsCharge TCP proxy starting', {
  tcp: config.tcp,
  api: config.api.baseUrl,
})

export { connections, externalIdToConnectionId }
