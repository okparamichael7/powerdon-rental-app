/**
 * WsCharge Protocol Simulator
 * 
 * Enterprise-grade hardware simulator for testing without physical stations.
 * Simulates realistic station behavior including:
 * - Connection/login flow
 * - Heartbeat responses
 * - Inventory queries
 * - Borrow (unlock) operations
 * - Return detection
 * - Error scenarios
 */

import * as net from 'net';
import * as crypto from 'crypto';

// Protocol constants
const START_BYTES = Buffer.from([0x68, 0x65]);
const END_BYTES = Buffer.from([0x0D, 0x0A]);

// Command types
const CMD = {
  LOGIN: 0x01,
  LOGIN_RESP: 0x81,
  HEARTBEAT: 0x02,
  HEARTBEAT_RESP: 0x82,
  INVENTORY_QUERY: 0x03,
  INVENTORY_RESP: 0x83,
  BORROW: 0x04,
  BORROW_RESP: 0x84,
  RETURN: 0x05,
  RETURN_RESP: 0x85,
  FORCE_EJECT: 0x06,
  FORCE_EJECT_RESP: 0x86,
  FULL_EJECT: 0x07,
  FULL_EJECT_RESP: 0x87,
  REBOOT: 0x08,
  REBOOT_RESP: 0x88,
  SETTINGS: 0x09,
  SETTINGS_RESP: 0x89,
};

// Slot status
const SLOT_STATUS = {
  EMPTY: 0x00,
  OCCUPIED: 0x01,
  CHARGING: 0x02,
  FAULT: 0x03,
  LOCKED: 0x04,
};

interface SimulatedSlot {
  status: number;
  batteryLevel: number;
  powerBankId: string | null;
  lastUpdated: Date;
}

interface SimulatedStation {
  deviceId: string;
  iccid: string;
  firmwareVersion: string;
  slots: SimulatedSlot[];
  isOnline: boolean;
  lastHeartbeat: Date;
}

interface SimulatorConfig {
  serverHost: string;
  serverPort: number;
  stationCount: number;
  slotsPerStation: number;
  heartbeatInterval: number;
  simulateFailures: boolean;
  failureRate: number;
  reconnectDelay: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

const defaultConfig: SimulatorConfig = {
  serverHost: process.env.TCP_SERVER_HOST || 'localhost',
  serverPort: parseInt(process.env.TCP_SERVER_PORT || '9000', 10),
  stationCount: parseInt(process.env.SIMULATOR_STATION_COUNT || '3', 10),
  slotsPerStation: parseInt(process.env.SIMULATOR_SLOTS_PER_STATION || '6', 10),
  heartbeatInterval: parseInt(process.env.SIMULATOR_HEARTBEAT_INTERVAL || '30000', 10),
  simulateFailures: process.env.SIMULATOR_FAILURES === 'true',
  failureRate: parseFloat(process.env.SIMULATOR_FAILURE_RATE || '0.05'),
  reconnectDelay: parseInt(process.env.SIMULATOR_RECONNECT_DELAY || '5000', 10),
  logLevel: (process.env.SIMULATOR_LOG_LEVEL as SimulatorConfig['logLevel']) || 'info',
};

class Logger {
  private level: SimulatorConfig['logLevel'];
  private levels = { debug: 0, info: 1, warn: 2, error: 3 };

  constructor(level: SimulatorConfig['logLevel']) {
    this.level = level;
  }

  private shouldLog(level: SimulatorConfig['logLevel']): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.log(`[DEBUG] ${new Date().toISOString()} ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.log(`[INFO]  ${new Date().toISOString()} ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN]  ${new Date().toISOString()} ${message}`, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${new Date().toISOString()} ${message}`, ...args);
    }
  }
}

// CRC16-CCITT calculation
function calculateCRC16(data: Buffer): number {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  return crc & 0xFFFF;
}

// Build protocol message
function buildMessage(deviceId: string, cmd: number, data: Buffer): Buffer {
  const deviceIdBuffer = Buffer.alloc(16);
  deviceIdBuffer.write(deviceId.padEnd(16, '\0'));
  
  const length = 2 + 16 + 1 + data.length + 2 + 2; // start + deviceId + cmd + data + crc + end
  const message = Buffer.alloc(length);
  let offset = 0;

  // Start bytes
  START_BYTES.copy(message, offset);
  offset += 2;

  // Device ID
  deviceIdBuffer.copy(message, offset);
  offset += 16;

  // Command
  message.writeUInt8(cmd, offset);
  offset += 1;

  // Data
  data.copy(message, offset);
  offset += data.length;

  // CRC16
  const crcData = message.slice(2, offset);
  const crc = calculateCRC16(crcData);
  message.writeUInt16BE(crc, offset);
  offset += 2;

  // End bytes
  END_BYTES.copy(message, offset);

  return message;
}

// Parse incoming message
function parseMessage(buffer: Buffer): { deviceId: string; cmd: number; data: Buffer } | null {
  if (buffer.length < 23) return null;
  
  // Verify start bytes
  if (buffer[0] !== 0x68 || buffer[1] !== 0x65) return null;
  
  // Verify end bytes
  if (buffer[buffer.length - 2] !== 0x0D || buffer[buffer.length - 1] !== 0x0A) return null;

  const deviceId = buffer.slice(2, 18).toString('utf8').replace(/\0/g, '').trim();
  const cmd = buffer.readUInt8(18);
  const data = buffer.slice(19, buffer.length - 4);

  return { deviceId, cmd, data };
}

// Generate random power bank ID
function generatePowerBankId(): string {
  return `PB${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

class StationSimulator {
  private station: SimulatedStation;
  private config: SimulatorConfig;
  private logger: Logger;
  private socket: net.Socket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private shouldReconnect = true;
  private messageBuffer = Buffer.alloc(0);

  constructor(stationIndex: number, config: SimulatorConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;

    // Generate station data
    const deviceId = `SIM${String(stationIndex + 1).padStart(3, '0')}`;
    const iccid = `8931${String(Math.random()).slice(2, 18).padStart(16, '0')}`;

    // Initialize slots with random state
    const slots: SimulatedSlot[] = [];
    for (let i = 0; i < config.slotsPerStation; i++) {
      const isOccupied = Math.random() > 0.3;
      slots.push({
        status: isOccupied ? SLOT_STATUS.OCCUPIED : SLOT_STATUS.EMPTY,
        batteryLevel: isOccupied ? Math.floor(Math.random() * 60) + 40 : 0,
        powerBankId: isOccupied ? generatePowerBankId() : null,
        lastUpdated: new Date(),
      });
    }

    this.station = {
      deviceId,
      iccid,
      firmwareVersion: '5.8P',
      slots,
      isOnline: false,
      lastHeartbeat: new Date(),
    };
  }

  start(): void {
    this.shouldReconnect = true;
    this.connect();
  }

  stop(): void {
    this.shouldReconnect = false;
    this.disconnect();
  }

  private connect(): void {
    if (this.isConnecting || (this.socket && !this.socket.destroyed)) {
      return;
    }

    this.isConnecting = true;
    this.logger.info(`[${this.station.deviceId}] Connecting to ${this.config.serverHost}:${this.config.serverPort}`);

    this.socket = new net.Socket();

    this.socket.on('connect', () => {
      this.isConnecting = false;
      this.station.isOnline = true;
      this.logger.info(`[${this.station.deviceId}] Connected, sending login`);
      this.sendLogin();
      this.startHeartbeat();
    });

    this.socket.on('data', (data) => {
      this.handleData(data);
    });

    this.socket.on('error', (err) => {
      this.logger.error(`[${this.station.deviceId}] Socket error:`, err.message);
    });

    this.socket.on('close', () => {
      this.isConnecting = false;
      this.station.isOnline = false;
      this.stopHeartbeat();
      this.logger.warn(`[${this.station.deviceId}] Connection closed`);

      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    });

    this.socket.connect(this.config.serverPort, this.config.serverHost);
  }

  private disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.logger.info(`[${this.station.deviceId}] Reconnecting in ${this.config.reconnectDelay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.config.reconnectDelay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendLogin(): void {
    // Login data: ICCID (20 bytes) + firmware version (10 bytes)
    const data = Buffer.alloc(30);
    data.write(this.station.iccid.padEnd(20, '\0'), 0, 20);
    data.write(this.station.firmwareVersion.padEnd(10, '\0'), 20, 10);

    const message = buildMessage(this.station.deviceId, CMD.LOGIN, data);
    this.send(message);
    this.logger.debug(`[${this.station.deviceId}] Sent LOGIN`);
  }

  private sendHeartbeat(): void {
    if (!this.socket || this.socket.destroyed) return;

    // Heartbeat data: slot count + summary status
    const occupiedSlots = this.station.slots.filter(s => s.status === SLOT_STATUS.OCCUPIED).length;
    const data = Buffer.alloc(4);
    data.writeUInt8(this.station.slots.length, 0);
    data.writeUInt8(occupiedSlots, 1);
    data.writeUInt16BE(0, 2); // Reserved

    const message = buildMessage(this.station.deviceId, CMD.HEARTBEAT, data);
    this.send(message);
    this.station.lastHeartbeat = new Date();
    this.logger.debug(`[${this.station.deviceId}] Sent HEARTBEAT (${occupiedSlots}/${this.station.slots.length} occupied)`);
  }

  private handleData(data: Buffer): void {
    // Accumulate data in buffer
    this.messageBuffer = Buffer.concat([this.messageBuffer, data]);

    // Process complete messages
    while (this.messageBuffer.length >= 23) {
      // Find start bytes
      const startIndex = this.messageBuffer.indexOf(START_BYTES);
      if (startIndex === -1) {
        this.messageBuffer = Buffer.alloc(0);
        break;
      }

      // Skip bytes before start
      if (startIndex > 0) {
        this.messageBuffer = this.messageBuffer.slice(startIndex);
      }

      // Find end bytes
      const endIndex = this.messageBuffer.indexOf(END_BYTES, 2);
      if (endIndex === -1) {
        break; // Wait for more data
      }

      // Extract complete message
      const messageBytes = this.messageBuffer.slice(0, endIndex + 2);
      this.messageBuffer = this.messageBuffer.slice(endIndex + 2);

      // Parse and handle message
      const parsed = parseMessage(messageBytes);
      if (parsed) {
        this.handleMessage(parsed);
      }
    }
  }

  private handleMessage(msg: { deviceId: string; cmd: number; data: Buffer }): void {
    this.logger.debug(`[${this.station.deviceId}] Received cmd=0x${msg.cmd.toString(16)}`);

    switch (msg.cmd) {
      case CMD.LOGIN_RESP:
        this.handleLoginResponse(msg.data);
        break;
      case CMD.HEARTBEAT_RESP:
        this.logger.debug(`[${this.station.deviceId}] Heartbeat acknowledged`);
        break;
      case CMD.INVENTORY_QUERY:
        this.handleInventoryQuery();
        break;
      case CMD.BORROW:
        this.handleBorrow(msg.data);
        break;
      case CMD.FORCE_EJECT:
        this.handleForceEject(msg.data);
        break;
      case CMD.FULL_EJECT:
        this.handleFullEject();
        break;
      case CMD.REBOOT:
        this.handleReboot();
        break;
      case CMD.SETTINGS:
        this.handleSettings(msg.data);
        break;
      default:
        this.logger.warn(`[${this.station.deviceId}] Unknown command: 0x${msg.cmd.toString(16)}`);
    }
  }

  private handleLoginResponse(data: Buffer): void {
    const success = data.length > 0 && data[0] === 0x00;
    if (success) {
      this.logger.info(`[${this.station.deviceId}] Login successful`);
    } else {
      this.logger.error(`[${this.station.deviceId}] Login failed`);
    }
  }

  private handleInventoryQuery(): void {
    // Build inventory response
    // Format: slot_count (1) + [slot_status (1) + battery (1) + powerbank_id (12)] * slot_count
    const slotDataSize = 1 + 1 + 12;
    const data = Buffer.alloc(1 + this.station.slots.length * slotDataSize);

    data.writeUInt8(this.station.slots.length, 0);
    let offset = 1;

    for (const slot of this.station.slots) {
      data.writeUInt8(slot.status, offset);
      data.writeUInt8(slot.batteryLevel, offset + 1);
      
      const pbIdBuffer = Buffer.alloc(12);
      if (slot.powerBankId) {
        pbIdBuffer.write(slot.powerBankId.slice(0, 12), 0);
      }
      pbIdBuffer.copy(data, offset + 2);
      
      offset += slotDataSize;
    }

    const message = buildMessage(this.station.deviceId, CMD.INVENTORY_RESP, data);
    this.send(message);
    this.logger.info(`[${this.station.deviceId}] Sent inventory response`);
  }

  private handleBorrow(data: Buffer): void {
    const slotNumber = data.readUInt8(0);
    const slotIndex = slotNumber - 1;

    // Simulate potential failure
    if (this.config.simulateFailures && Math.random() < this.config.failureRate) {
      this.sendBorrowResponse(slotNumber, 0x02, null); // Hardware error
      this.logger.warn(`[${this.station.deviceId}] Simulated borrow failure for slot ${slotNumber}`);
      return;
    }

    if (slotIndex < 0 || slotIndex >= this.station.slots.length) {
      this.sendBorrowResponse(slotNumber, 0x01, null); // Invalid slot
      return;
    }

    const slot = this.station.slots[slotIndex];
    if (slot.status !== SLOT_STATUS.OCCUPIED) {
      this.sendBorrowResponse(slotNumber, 0x03, null); // Slot empty
      return;
    }

    // Simulate unlock
    const powerBankId = slot.powerBankId;
    slot.status = SLOT_STATUS.EMPTY;
    slot.batteryLevel = 0;
    slot.powerBankId = null;
    slot.lastUpdated = new Date();

    this.sendBorrowResponse(slotNumber, 0x00, powerBankId);
    this.logger.info(`[${this.station.deviceId}] Unlocked slot ${slotNumber}, dispensed ${powerBankId}`);
  }

  private sendBorrowResponse(slotNumber: number, status: number, powerBankId: string | null): void {
    const data = Buffer.alloc(14);
    data.writeUInt8(slotNumber, 0);
    data.writeUInt8(status, 1);
    
    if (powerBankId) {
      data.write(powerBankId.slice(0, 12), 2, 12);
    }

    const message = buildMessage(this.station.deviceId, CMD.BORROW_RESP, data);
    this.send(message);
  }

  private handleForceEject(data: Buffer): void {
    const slotNumber = data.readUInt8(0);
    const slotIndex = slotNumber - 1;

    if (slotIndex < 0 || slotIndex >= this.station.slots.length) {
      this.sendForceEjectResponse(slotNumber, 0x01);
      return;
    }

    const slot = this.station.slots[slotIndex];
    if (slot.status === SLOT_STATUS.OCCUPIED) {
      slot.status = SLOT_STATUS.EMPTY;
      slot.batteryLevel = 0;
      slot.powerBankId = null;
      slot.lastUpdated = new Date();
    }

    this.sendForceEjectResponse(slotNumber, 0x00);
    this.logger.info(`[${this.station.deviceId}] Force ejected slot ${slotNumber}`);
  }

  private sendForceEjectResponse(slotNumber: number, status: number): void {
    const data = Buffer.alloc(2);
    data.writeUInt8(slotNumber, 0);
    data.writeUInt8(status, 1);

    const message = buildMessage(this.station.deviceId, CMD.FORCE_EJECT_RESP, data);
    this.send(message);
  }

  private handleFullEject(): void {
    let ejectedCount = 0;
    for (const slot of this.station.slots) {
      if (slot.status === SLOT_STATUS.OCCUPIED) {
        slot.status = SLOT_STATUS.EMPTY;
        slot.batteryLevel = 0;
        slot.powerBankId = null;
        slot.lastUpdated = new Date();
        ejectedCount++;
      }
    }

    const data = Buffer.alloc(2);
    data.writeUInt8(0x00, 0); // Success
    data.writeUInt8(ejectedCount, 1);

    const message = buildMessage(this.station.deviceId, CMD.FULL_EJECT_RESP, data);
    this.send(message);
    this.logger.info(`[${this.station.deviceId}] Full eject: ${ejectedCount} power banks ejected`);
  }

  private handleReboot(): void {
    this.logger.info(`[${this.station.deviceId}] Reboot requested, simulating...`);

    // Send response before "rebooting"
    const data = Buffer.alloc(1);
    data.writeUInt8(0x00, 0);
    const message = buildMessage(this.station.deviceId, CMD.REBOOT_RESP, data);
    this.send(message);

    // Simulate reboot by disconnecting and reconnecting
    setTimeout(() => {
      this.disconnect();
      setTimeout(() => {
        if (this.shouldReconnect) {
          this.connect();
        }
      }, 3000);
    }, 500);
  }

  private handleSettings(data: Buffer): void {
    // Just acknowledge settings
    const response = Buffer.alloc(1);
    response.writeUInt8(0x00, 0);

    const message = buildMessage(this.station.deviceId, CMD.SETTINGS_RESP, response);
    this.send(message);
    this.logger.info(`[${this.station.deviceId}] Settings updated`);
  }

  private send(data: Buffer): void {
    if (this.socket && !this.socket.destroyed) {
      this.socket.write(data);
    }
  }

  // Simulate a power bank return
  simulateReturn(slotNumber?: number): void {
    // Find an empty slot
    let targetSlotIndex = -1;
    if (slotNumber !== undefined) {
      targetSlotIndex = slotNumber - 1;
    } else {
      for (let i = 0; i < this.station.slots.length; i++) {
        if (this.station.slots[i].status === SLOT_STATUS.EMPTY) {
          targetSlotIndex = i;
          break;
        }
      }
    }

    if (targetSlotIndex < 0 || targetSlotIndex >= this.station.slots.length) {
      this.logger.warn(`[${this.station.deviceId}] Cannot simulate return: no empty slot`);
      return;
    }

    const slot = this.station.slots[targetSlotIndex];
    if (slot.status !== SLOT_STATUS.EMPTY) {
      this.logger.warn(`[${this.station.deviceId}] Cannot simulate return: slot ${targetSlotIndex + 1} not empty`);
      return;
    }

    // Simulate return
    const powerBankId = generatePowerBankId();
    slot.status = SLOT_STATUS.OCCUPIED;
    slot.batteryLevel = Math.floor(Math.random() * 30) + 10; // 10-40% after use
    slot.powerBankId = powerBankId;
    slot.lastUpdated = new Date();

    // Send return notification
    const data = Buffer.alloc(14);
    data.writeUInt8(targetSlotIndex + 1, 0); // Slot number (1-indexed)
    data.writeUInt8(slot.batteryLevel, 1);
    data.write(powerBankId.slice(0, 12), 2, 12);

    const message = buildMessage(this.station.deviceId, CMD.RETURN, data);
    this.send(message);
    this.logger.info(`[${this.station.deviceId}] Simulated return: ${powerBankId} to slot ${targetSlotIndex + 1}`);
  }

  getStatus(): SimulatedStation {
    return { ...this.station };
  }
}

class WsChargeSimulator {
  private config: SimulatorConfig;
  private logger: Logger;
  private stations: StationSimulator[] = [];
  private commandServer: net.Server | null = null;

  constructor(config: Partial<SimulatorConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.logger = new Logger(this.config.logLevel);
  }

  start(): void {
    this.logger.info('Starting WsCharge Simulator');
    this.logger.info(`Configuration: ${this.config.stationCount} stations, ${this.config.slotsPerStation} slots each`);

    // Create simulated stations
    for (let i = 0; i < this.config.stationCount; i++) {
      const station = new StationSimulator(i, this.config, this.logger);
      this.stations.push(station);
      station.start();
    }

    // Start command server for external control
    this.startCommandServer();

    this.logger.info('Simulator started');
  }

  stop(): void {
    this.logger.info('Stopping simulator');

    for (const station of this.stations) {
      station.stop();
    }
    this.stations = [];

    if (this.commandServer) {
      this.commandServer.close();
      this.commandServer = null;
    }

    this.logger.info('Simulator stopped');
  }

  private startCommandServer(): void {
    const port = parseInt(process.env.SIMULATOR_COMMAND_PORT || '9001', 10);

    this.commandServer = net.createServer((socket) => {
      this.logger.info('Command client connected');

      socket.on('data', (data) => {
        try {
          const command = JSON.parse(data.toString());
          const result = this.handleCommand(command);
          socket.write(JSON.stringify(result) + '\n');
        } catch (err) {
          socket.write(JSON.stringify({ error: 'Invalid command' }) + '\n');
        }
      });

      socket.on('close', () => {
        this.logger.info('Command client disconnected');
      });
    });

    this.commandServer.listen(port, () => {
      this.logger.info(`Command server listening on port ${port}`);
    });
  }

  private handleCommand(command: { action: string; stationIndex?: number; slotNumber?: number }): unknown {
    switch (command.action) {
      case 'status':
        return {
          stations: this.stations.map((s, i) => ({
            index: i,
            ...s.getStatus(),
          })),
        };

      case 'simulate_return':
        if (command.stationIndex !== undefined && command.stationIndex < this.stations.length) {
          this.stations[command.stationIndex].simulateReturn(command.slotNumber);
          return { success: true };
        }
        return { error: 'Invalid station index' };

      case 'restart_station':
        if (command.stationIndex !== undefined && command.stationIndex < this.stations.length) {
          this.stations[command.stationIndex].stop();
          setTimeout(() => {
            this.stations[command.stationIndex!].start();
          }, 1000);
          return { success: true };
        }
        return { error: 'Invalid station index' };

      default:
        return { error: 'Unknown action' };
    }
  }
}

// CLI entry point
if (require.main === module) {
  const simulator = new WsChargeSimulator();

  process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down...');
    simulator.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down...');
    simulator.stop();
    process.exit(0);
  });

  simulator.start();
}

export { WsChargeSimulator, StationSimulator, SimulatorConfig };
