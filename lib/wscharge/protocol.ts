// WsCharge Communication Protocol Implementation
// Based on Shenzhen Worthy Network Technology Co. Protocol v5.8P (July 2024)

// Protocol command codes
export enum CommandCode {
  LOGIN = 0x60,
  HEARTBEAT = 0x61,
  QUERY_VERSION = 0x62,
  SET_SERVER_ADDRESS = 0x63,
  QUERY_INVENTORY = 0x64,
  BORROW_POWERBANK = 0x65,
  RETURN_POWERBANK = 0x66,
  REMOTE_REBOOT = 0x67,
  REMOTE_UPGRADE = 0x68,
  QUERY_ICCID = 0x69,
  QUERY_SERVER_ADDRESS = 0x6a,
  QUERY_NETWORK_INFO = 0x71,
  FORCE_EJECT = 0x80,
  STACKED_FULL_EJECT = 0x81,
  STACKED_QUERY_CARD = 0x82,
}

// Token is fixed at 0x11223344 for both directions
export const PROTOCOL_TOKEN = 0x11223344;
export const PROTOCOL_VERSION = 0x01;

// Power bank battery level definitions
export enum BatteryLevel {
  LEVEL_20 = 0,
  LEVEL_40 = 1,
  LEVEL_60 = 2,
  LEVEL_80 = 3,
  LEVEL_100 = 4,
}

// Login result codes
export enum LoginResult {
  FAILURE = 0,
  SUCCESS = 1,
  TIME_ERROR = 2,
}

// Return result codes
export enum ReturnResult {
  FAILURE = 0,
  SUCCESS = 1,
  ABNORMAL_STATE = 2,
  REPEATED_RETURN = 3,
  ILLEGAL_BATTERY = 4,
  SLOT_NOT_EMPTY = 5,
}

// Borrow/Eject result codes
export enum BorrowResult {
  FAILURE = 0,
  SUCCESS = 1,
}

// Protocol message structure
export interface ProtocolMessage {
  packetLength: number;
  command: CommandCode;
  version: number;
  checksum: number;
  token: number;
  payload: Buffer;
}

// Slot inventory item
export interface SlotInventory {
  slotNumber: number;
  terminalId: string; // 8-byte power bank ID as hex string
  batteryLevel: BatteryLevel;
}

// Parsed message types
export interface LoginMessage {
  command: CommandCode.LOGIN;
  random: number;
  magic: number;
  productSn: string;
}

export interface HeartbeatMessage {
  command: CommandCode.HEARTBEAT;
}

export interface InventoryResponse {
  command: CommandCode.QUERY_INVENTORY;
  remainingCount: number;
  slots: SlotInventory[];
}

export interface BorrowResponse {
  command: CommandCode.BORROW_POWERBANK;
  slotNumber: number;
  result: BorrowResult;
  terminalId: string;
}

export interface ReturnMessage {
  command: CommandCode.RETURN_POWERBANK;
  slotNumber: number;
  terminalId: string;
}

export interface ForceEjectResponse {
  command: CommandCode.FORCE_EJECT | CommandCode.STACKED_FULL_EJECT;
  slotNumber: number;
  result: BorrowResult;
  terminalId: string;
}

export interface NetworkInfoResponse {
  command: CommandCode.QUERY_NETWORK_INFO;
  signalStrength: number;
  networkType: string;
}

export interface IccidResponse {
  command: CommandCode.QUERY_ICCID;
  iccid: string;
}

export interface VersionResponse {
  command: CommandCode.QUERY_VERSION;
  version: string;
}

export interface ServerAddressResponse {
  command: CommandCode.QUERY_SERVER_ADDRESS;
  address: string;
  port: number;
}

// Calculate XOR checksum for payload
export function calculateChecksum(payload: Buffer): number {
  let checksum = 0;
  for (let i = 0; i < payload.length; i++) {
    checksum ^= payload[i];
  }
  return checksum;
}

// Parse incoming message from cabinet
export function parseMessage(data: Buffer): ProtocolMessage | null {
  if (data.length < 9) {
    console.error('[WsCharge] Message too short:', data.length);
    return null;
  }

  const packetLength = data.readUInt16BE(0);
  const command = data.readUInt8(2) as CommandCode;
  const version = data.readUInt8(3);
  const checksum = data.readUInt8(4);
  const token = data.readUInt32BE(5);
  const payload = data.subarray(9, 2 + packetLength);

  // Verify checksum
  const calculatedChecksum = calculateChecksum(payload);
  if (calculatedChecksum !== checksum) {
    console.error('[WsCharge] Checksum mismatch:', { expected: checksum, calculated: calculatedChecksum });
    return null;
  }

  return {
    packetLength,
    command,
    version,
    checksum,
    token,
    payload,
  };
}

// Build outgoing message to cabinet
export function buildMessage(command: CommandCode, payload: Buffer = Buffer.alloc(0)): Buffer {
  const packetLength = 7 + payload.length; // 1 cmd + 1 vsn + 1 checksum + 4 token + payload
  const checksum = calculateChecksum(payload);

  const message = Buffer.alloc(2 + packetLength);
  message.writeUInt16BE(packetLength, 0);
  message.writeUInt8(command, 2);
  message.writeUInt8(PROTOCOL_VERSION, 3);
  message.writeUInt8(checksum, 4);
  message.writeUInt32BE(PROTOCOL_TOKEN, 5);
  payload.copy(message, 9);

  return message;
}

// Parse login message from cabinet
export function parseLoginMessage(message: ProtocolMessage): LoginMessage | null {
  if (message.command !== CommandCode.LOGIN) return null;
  
  const payload = message.payload;
  if (payload.length < 8) return null;

  const random = payload.readUInt32BE(0);
  const magic = payload.readUInt16BE(4);
  const productSnLen = payload.readUInt16BE(6);
  const productSn = payload.subarray(8, 8 + productSnLen - 1).toString('utf8'); // -1 for null terminator

  return {
    command: CommandCode.LOGIN,
    random,
    magic,
    productSn,
  };
}

// Build login response
export function buildLoginResponse(result: LoginResult): Buffer {
  const payload = Buffer.alloc(1);
  payload.writeUInt8(result, 0);
  return buildMessage(CommandCode.LOGIN, payload);
}

// Build heartbeat response
export function buildHeartbeatResponse(): Buffer {
  return buildMessage(CommandCode.HEARTBEAT);
}

// Build inventory query command
export function buildInventoryQuery(): Buffer {
  return buildMessage(CommandCode.QUERY_INVENTORY);
}

// Parse inventory response from cabinet
export function parseInventoryResponse(message: ProtocolMessage): InventoryResponse | null {
  if (message.command !== CommandCode.QUERY_INVENTORY) return null;

  const payload = message.payload;
  if (payload.length < 1) return null;

  const remainingCount = payload.readUInt8(0);
  const slots: SlotInventory[] = [];

  // Each slot entry: 1 byte slot + 8 bytes terminalId + 1 byte level = 10 bytes
  let offset = 1;
  while (offset + 10 <= payload.length) {
    const slotNumber = payload.readUInt8(offset);
    const terminalId = payload.subarray(offset + 1, offset + 9).toString('hex').toUpperCase();
    const batteryLevel = payload.readUInt8(offset + 9) as BatteryLevel;

    slots.push({ slotNumber, terminalId, batteryLevel });
    offset += 10;
  }

  return {
    command: CommandCode.QUERY_INVENTORY,
    remainingCount,
    slots,
  };
}

// Build borrow/unlock command
export function buildBorrowCommand(slotNumber: number): Buffer {
  const payload = Buffer.alloc(1);
  payload.writeUInt8(slotNumber, 0);
  return buildMessage(CommandCode.BORROW_POWERBANK, payload);
}

// Parse borrow response from cabinet
export function parseBorrowResponse(message: ProtocolMessage): BorrowResponse | null {
  if (message.command !== CommandCode.BORROW_POWERBANK) return null;

  const payload = message.payload;
  if (payload.length < 10) return null;

  const slotNumber = payload.readUInt8(0);
  const result = payload.readUInt8(1) as BorrowResult;
  const terminalId = payload.subarray(2, 10).toString('hex').toUpperCase();

  return {
    command: CommandCode.BORROW_POWERBANK,
    slotNumber,
    result,
    terminalId,
  };
}

// Parse return message from cabinet (cabinet initiates this)
export function parseReturnMessage(message: ProtocolMessage): ReturnMessage | null {
  if (message.command !== CommandCode.RETURN_POWERBANK) return null;

  const payload = message.payload;
  if (payload.length < 9) return null;

  const slotNumber = payload.readUInt8(0);
  const terminalId = payload.subarray(1, 9).toString('hex').toUpperCase();

  return {
    command: CommandCode.RETURN_POWERBANK,
    slotNumber,
    terminalId,
  };
}

// Build return response to cabinet
export function buildReturnResponse(slotNumber: number, result: ReturnResult): Buffer {
  const payload = Buffer.alloc(2);
  payload.writeUInt8(slotNumber, 0);
  payload.writeUInt8(result, 1);
  return buildMessage(CommandCode.RETURN_POWERBANK, payload);
}

// Build force eject command
export function buildForceEjectCommand(slotNumber: number): Buffer {
  const payload = Buffer.alloc(1);
  payload.writeUInt8(slotNumber, 0);
  return buildMessage(CommandCode.FORCE_EJECT, payload);
}

// Build full eject command (slot 0x00 = all slots)
export function buildFullEjectCommand(): Buffer {
  const payload = Buffer.alloc(1);
  payload.writeUInt8(0x00, 0);
  return buildMessage(CommandCode.FORCE_EJECT, payload);
}

// Parse force eject response
export function parseForceEjectResponse(message: ProtocolMessage): ForceEjectResponse | null {
  if (message.command !== CommandCode.FORCE_EJECT) return null;

  const payload = message.payload;
  if (payload.length < 10) return null;

  const slotNumber = payload.readUInt8(0);
  const result = payload.readUInt8(1) as BorrowResult;
  const terminalId = payload.subarray(2, 10).toString('hex').toUpperCase();

  return {
    command: CommandCode.FORCE_EJECT,
    slotNumber,
    result,
    terminalId,
  };
}

// Build network info query
export function buildNetworkInfoQuery(): Buffer {
  return buildMessage(CommandCode.QUERY_NETWORK_INFO);
}

// Build ICCID query
export function buildIccidQuery(): Buffer {
  return buildMessage(CommandCode.QUERY_ICCID);
}

// Build version query
export function buildVersionQuery(): Buffer {
  return buildMessage(CommandCode.QUERY_VERSION);
}

// Build server address query
export function buildServerAddressQuery(): Buffer {
  return buildMessage(CommandCode.QUERY_SERVER_ADDRESS);
}

// Build set server address command
export function buildSetServerAddress(address: string, port: number): Buffer {
  const addressBytes = Buffer.from(address + '\0', 'utf8');
  const payload = Buffer.alloc(addressBytes.length + 2);
  addressBytes.copy(payload, 0);
  payload.writeUInt16BE(port, addressBytes.length);
  return buildMessage(CommandCode.SET_SERVER_ADDRESS, payload);
}

// Build remote reboot command
export function buildRemoteRebootCommand(): Buffer {
  return buildMessage(CommandCode.REMOTE_REBOOT);
}

// Build remote upgrade command
export function buildRemoteUpgradeCommand(ftpUrl: string): Buffer {
  const urlBytes = Buffer.from(ftpUrl + '\0', 'utf8');
  return buildMessage(CommandCode.REMOTE_UPGRADE, urlBytes);
}

// Battery level to percentage
export function batteryLevelToPercent(level: BatteryLevel): number {
  switch (level) {
    case BatteryLevel.LEVEL_20: return 20;
    case BatteryLevel.LEVEL_40: return 40;
    case BatteryLevel.LEVEL_60: return 60;
    case BatteryLevel.LEVEL_80: return 80;
    case BatteryLevel.LEVEL_100: return 100;
    default: return 0;
  }
}

// Helper to convert hex string to readable format
export function formatTerminalId(terminalId: string): string {
  return terminalId.match(/.{2}/g)?.join(':') || terminalId;
}

/** Parse length-prefixed UTF-8 string (Uint16 length includes null terminator per spec). */
function parseLengthPrefixedString(payload: Buffer, offset: number): { value: string; nextOffset: number } | null {
  if (offset + 2 > payload.length) return null;
  const len = payload.readUInt16BE(offset);
  if (len < 1 || offset + 2 + len > payload.length) return null;
  const value = payload.subarray(offset + 2, offset + 2 + len - 1).toString('utf8');
  return { value, nextOffset: offset + 2 + len };
}

export function parseNetworkInfoResponse(message: ProtocolMessage): NetworkInfoResponse | null {
  if (message.command !== CommandCode.QUERY_NETWORK_INFO) return null;
  if (message.payload.length < 1) return null;
  const signalStrength = message.payload.readUInt8(0);
  return {
    command: CommandCode.QUERY_NETWORK_INFO,
    signalStrength,
    networkType: 'cellular',
  };
}

export function parseIccidResponse(message: ProtocolMessage): IccidResponse | null {
  if (message.command !== CommandCode.QUERY_ICCID) return null;
  const parsed = parseLengthPrefixedString(message.payload, 0);
  if (!parsed) return null;
  return { command: CommandCode.QUERY_ICCID, iccid: parsed.value };
}

export function parseVersionResponse(message: ProtocolMessage): VersionResponse | null {
  if (message.command !== CommandCode.QUERY_VERSION) return null;
  const parsed = parseLengthPrefixedString(message.payload, 0);
  if (!parsed) return null;
  return { command: CommandCode.QUERY_VERSION, version: parsed.value };
}

export function parseServerAddressResponse(message: ProtocolMessage): ServerAddressResponse | null {
  if (message.command !== CommandCode.QUERY_SERVER_ADDRESS) return null;
  const parsed = parseLengthPrefixedString(message.payload, 0);
  if (!parsed) return null;
  const portOffset = parsed.nextOffset;
  if (portOffset + 2 > message.payload.length) return null;
  const port = message.payload.readUInt16BE(portOffset);
  return {
    command: CommandCode.QUERY_SERVER_ADDRESS,
    address: parsed.value,
    port,
  };
}

export function parseStackedEjectResponse(message: ProtocolMessage): ForceEjectResponse | null {
  if (message.command !== CommandCode.STACKED_FULL_EJECT) return null;
  const payload = message.payload;
  if (payload.length < 10) return null;
  const slotNumber = payload.readUInt8(0);
  const result = payload.readUInt8(1) as BorrowResult;
  const terminalId = payload.subarray(2, 10).toString('hex').toUpperCase();
  return {
    command: CommandCode.STACKED_FULL_EJECT,
    slotNumber,
    result,
    terminalId,
  };
}

export function parseStackedCardCountResponse(message: ProtocolMessage): { count: number } | null {
  if (message.command !== CommandCode.STACKED_QUERY_CARD) return null;
  if (message.payload.length < 1) return null;
  return { count: message.payload.readUInt8(0) };
}

export function validateProtocolToken(token: number): boolean {
  return token === PROTOCOL_TOKEN;
}

// Parse complete message from buffer (handles partial reads)
export function extractMessages(buffer: Buffer): { messages: ProtocolMessage[]; remaining: Buffer } {
  const messages: ProtocolMessage[] = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const packetLength = buffer.readUInt16BE(offset);
    const totalLength = 2 + packetLength;

    if (offset + totalLength > buffer.length) {
      // Incomplete message, return remaining buffer
      break;
    }

    const messageBuffer = buffer.subarray(offset, offset + totalLength);
    const parsed = parseMessage(messageBuffer);
    if (parsed) {
      messages.push(parsed);
    }
    offset += totalLength;
  }

  return {
    messages,
    remaining: buffer.subarray(offset),
  };
}
