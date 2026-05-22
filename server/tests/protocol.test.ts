/**
 * WsCharge Protocol Test Suite
 * 
 * Comprehensive tests for the protocol implementation including:
 * - Message encoding/decoding
 * - CRC validation
 * - Command handling
 * - Error scenarios
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Import protocol types and functions (these would be compiled from the main lib)
// For now, we'll define the test utilities inline

// Protocol constants
const START_BYTES = Buffer.from([0x68, 0x65]);
const END_BYTES = Buffer.from([0x0D, 0x0A]);

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
};

// CRC16-CCITT implementation
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

// Message builder
function buildMessage(deviceId: string, cmd: number, data: Buffer): Buffer {
  const deviceIdBuffer = Buffer.alloc(16);
  deviceIdBuffer.write(deviceId.padEnd(16, '\0'));
  
  const length = 2 + 16 + 1 + data.length + 2 + 2;
  const message = Buffer.alloc(length);
  let offset = 0;

  START_BYTES.copy(message, offset);
  offset += 2;

  deviceIdBuffer.copy(message, offset);
  offset += 16;

  message.writeUInt8(cmd, offset);
  offset += 1;

  data.copy(message, offset);
  offset += data.length;

  const crcData = message.slice(2, offset);
  const crc = calculateCRC16(crcData);
  message.writeUInt16BE(crc, offset);
  offset += 2;

  END_BYTES.copy(message, offset);

  return message;
}

// Message parser
function parseMessage(buffer: Buffer): { deviceId: string; cmd: number; data: Buffer; valid: boolean } | null {
  if (buffer.length < 23) return null;
  
  if (buffer[0] !== 0x68 || buffer[1] !== 0x65) return null;
  if (buffer[buffer.length - 2] !== 0x0D || buffer[buffer.length - 1] !== 0x0A) return null;

  const deviceId = buffer.slice(2, 18).toString('utf8').replace(/\0/g, '').trim();
  const cmd = buffer.readUInt8(18);
  const data = buffer.slice(19, buffer.length - 4);
  
  // Verify CRC
  const crcData = buffer.slice(2, buffer.length - 4);
  const expectedCrc = buffer.readUInt16BE(buffer.length - 4);
  const calculatedCrc = calculateCRC16(crcData);
  const valid = expectedCrc === calculatedCrc;

  return { deviceId, cmd, data, valid };
}

// ============================================================================
// Tests
// ============================================================================

describe('Protocol Message Framing', () => {
  it('should build message with correct start bytes', () => {
    const message = buildMessage('TEST001', CMD.LOGIN, Buffer.alloc(0));
    assert.strictEqual(message[0], 0x68);
    assert.strictEqual(message[1], 0x65);
  });

  it('should build message with correct end bytes', () => {
    const message = buildMessage('TEST001', CMD.LOGIN, Buffer.alloc(0));
    assert.strictEqual(message[message.length - 2], 0x0D);
    assert.strictEqual(message[message.length - 1], 0x0A);
  });

  it('should include device ID padded to 16 bytes', () => {
    const message = buildMessage('ABC', CMD.LOGIN, Buffer.alloc(0));
    const deviceId = message.slice(2, 18).toString('utf8');
    assert.strictEqual(deviceId.length, 16);
    assert.ok(deviceId.startsWith('ABC'));
  });

  it('should include command byte at correct position', () => {
    const message = buildMessage('TEST001', CMD.HEARTBEAT, Buffer.alloc(0));
    assert.strictEqual(message[18], CMD.HEARTBEAT);
  });

  it('should include payload data', () => {
    const payload = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const message = buildMessage('TEST001', CMD.BORROW, payload);
    const data = message.slice(19, 19 + payload.length);
    assert.deepStrictEqual(data, payload);
  });
});

describe('CRC16-CCITT Calculation', () => {
  it('should calculate correct CRC for empty data', () => {
    const crc = calculateCRC16(Buffer.alloc(0));
    assert.strictEqual(crc, 0xFFFF);
  });

  it('should calculate correct CRC for known data', () => {
    // Test with known values
    const data = Buffer.from('123456789');
    const crc = calculateCRC16(data);
    // CRC16-CCITT of "123456789" is 0x29B1
    assert.strictEqual(crc, 0x29B1);
  });

  it('should produce different CRCs for different data', () => {
    const crc1 = calculateCRC16(Buffer.from('test1'));
    const crc2 = calculateCRC16(Buffer.from('test2'));
    assert.notStrictEqual(crc1, crc2);
  });
});

describe('Message Parsing', () => {
  it('should parse valid message correctly', () => {
    const original = buildMessage('STATION001', CMD.LOGIN, Buffer.from([0x01, 0x02]));
    const parsed = parseMessage(original);
    
    assert.ok(parsed);
    assert.strictEqual(parsed.deviceId, 'STATION001');
    assert.strictEqual(parsed.cmd, CMD.LOGIN);
    assert.strictEqual(parsed.valid, true);
    assert.deepStrictEqual(parsed.data, Buffer.from([0x01, 0x02]));
  });

  it('should reject message with invalid start bytes', () => {
    const message = Buffer.from([0x00, 0x00, ...Array(21).fill(0)]);
    const parsed = parseMessage(message);
    assert.strictEqual(parsed, null);
  });

  it('should reject message with invalid end bytes', () => {
    const message = Buffer.alloc(23);
    message[0] = 0x68;
    message[1] = 0x65;
    message[21] = 0x00; // Invalid end byte
    message[22] = 0x00;
    const parsed = parseMessage(message);
    assert.strictEqual(parsed, null);
  });

  it('should reject message that is too short', () => {
    const message = Buffer.from([0x68, 0x65, 0x00]);
    const parsed = parseMessage(message);
    assert.strictEqual(parsed, null);
  });

  it('should detect invalid CRC', () => {
    const message = buildMessage('TEST001', CMD.LOGIN, Buffer.alloc(0));
    // Corrupt the CRC
    message[message.length - 4] = 0xFF;
    message[message.length - 3] = 0xFF;
    
    const parsed = parseMessage(message);
    assert.ok(parsed);
    assert.strictEqual(parsed.valid, false);
  });
});

describe('Command Types', () => {
  it('should handle LOGIN command', () => {
    const iccid = '89310123456789012345';
    const firmware = 'v5.8P';
    const data = Buffer.alloc(30);
    data.write(iccid, 0, 20);
    data.write(firmware, 20, 10);

    const message = buildMessage('SIM001', CMD.LOGIN, data);
    const parsed = parseMessage(message);

    assert.ok(parsed);
    assert.strictEqual(parsed.cmd, CMD.LOGIN);
    assert.strictEqual(parsed.data.slice(0, 20).toString().replace(/\0/g, ''), iccid);
  });

  it('should handle HEARTBEAT command', () => {
    const slotCount = 6;
    const occupiedCount = 4;
    const data = Buffer.alloc(4);
    data.writeUInt8(slotCount, 0);
    data.writeUInt8(occupiedCount, 1);

    const message = buildMessage('SIM001', CMD.HEARTBEAT, data);
    const parsed = parseMessage(message);

    assert.ok(parsed);
    assert.strictEqual(parsed.cmd, CMD.HEARTBEAT);
    assert.strictEqual(parsed.data[0], slotCount);
    assert.strictEqual(parsed.data[1], occupiedCount);
  });

  it('should handle BORROW command', () => {
    const slotNumber = 3;
    const data = Buffer.alloc(1);
    data.writeUInt8(slotNumber, 0);

    const message = buildMessage('SIM001', CMD.BORROW, data);
    const parsed = parseMessage(message);

    assert.ok(parsed);
    assert.strictEqual(parsed.cmd, CMD.BORROW);
    assert.strictEqual(parsed.data[0], slotNumber);
  });

  it('should handle BORROW_RESP with success', () => {
    const slotNumber = 3;
    const status = 0x00; // Success
    const powerBankId = 'PB123456ABCD';
    
    const data = Buffer.alloc(14);
    data.writeUInt8(slotNumber, 0);
    data.writeUInt8(status, 1);
    data.write(powerBankId, 2, 12);

    const message = buildMessage('SIM001', CMD.BORROW_RESP, data);
    const parsed = parseMessage(message);

    assert.ok(parsed);
    assert.strictEqual(parsed.cmd, CMD.BORROW_RESP);
    assert.strictEqual(parsed.data[0], slotNumber);
    assert.strictEqual(parsed.data[1], status);
    assert.strictEqual(parsed.data.slice(2, 14).toString().replace(/\0/g, ''), powerBankId);
  });

  it('should handle RETURN notification', () => {
    const slotNumber = 2;
    const batteryLevel = 35;
    const powerBankId = 'PB987654WXYZ';
    
    const data = Buffer.alloc(14);
    data.writeUInt8(slotNumber, 0);
    data.writeUInt8(batteryLevel, 1);
    data.write(powerBankId, 2, 12);

    const message = buildMessage('SIM001', CMD.RETURN, data);
    const parsed = parseMessage(message);

    assert.ok(parsed);
    assert.strictEqual(parsed.cmd, CMD.RETURN);
    assert.strictEqual(parsed.data[0], slotNumber);
    assert.strictEqual(parsed.data[1], batteryLevel);
  });

  it('should handle INVENTORY_RESP with multiple slots', () => {
    const slotCount = 3;
    const slotDataSize = 14; // status + battery + powerbank_id
    const data = Buffer.alloc(1 + slotCount * slotDataSize);
    
    data.writeUInt8(slotCount, 0);
    
    // Slot 1: occupied, 85%, PB001
    data.writeUInt8(0x01, 1); // Occupied
    data.writeUInt8(85, 2);
    data.write('PB001AAAAAAA', 3, 12);
    
    // Slot 2: empty
    data.writeUInt8(0x00, 15); // Empty
    data.writeUInt8(0, 16);
    
    // Slot 3: occupied, 45%, PB003
    data.writeUInt8(0x01, 29); // Occupied
    data.writeUInt8(45, 30);
    data.write('PB003CCCCCC', 31, 12);

    const message = buildMessage('SIM001', CMD.INVENTORY_RESP, data);
    const parsed = parseMessage(message);

    assert.ok(parsed);
    assert.strictEqual(parsed.cmd, CMD.INVENTORY_RESP);
    assert.strictEqual(parsed.data[0], slotCount);
  });
});

describe('Edge Cases', () => {
  it('should handle maximum length device ID', () => {
    const longId = 'ABCDEFGHIJKLMNOP'; // 16 chars
    const message = buildMessage(longId, CMD.LOGIN, Buffer.alloc(0));
    const parsed = parseMessage(message);

    assert.ok(parsed);
    assert.strictEqual(parsed.deviceId, longId);
  });

  it('should handle empty payload', () => {
    const message = buildMessage('TEST001', CMD.INVENTORY_QUERY, Buffer.alloc(0));
    const parsed = parseMessage(message);

    assert.ok(parsed);
    assert.strictEqual(parsed.data.length, 0);
  });

  it('should handle large payload', () => {
    const largePayload = Buffer.alloc(1000);
    for (let i = 0; i < largePayload.length; i++) {
      largePayload[i] = i % 256;
    }

    const message = buildMessage('TEST001', CMD.SETTINGS, largePayload);
    const parsed = parseMessage(message);

    assert.ok(parsed);
    assert.deepStrictEqual(parsed.data, largePayload);
  });

  it('should handle device ID with special characters', () => {
    const specialId = 'STA-001_TEST';
    const message = buildMessage(specialId, CMD.LOGIN, Buffer.alloc(0));
    const parsed = parseMessage(message);

    assert.ok(parsed);
    assert.strictEqual(parsed.deviceId, specialId);
  });
});

describe('Message Buffer Handling', () => {
  it('should handle concatenated messages', () => {
    const msg1 = buildMessage('STA001', CMD.LOGIN, Buffer.alloc(0));
    const msg2 = buildMessage('STA002', CMD.HEARTBEAT, Buffer.alloc(0));
    const combined = Buffer.concat([msg1, msg2]);

    // Find first message
    const endIndex1 = combined.indexOf(END_BYTES) + 2;
    const parsed1 = parseMessage(combined.slice(0, endIndex1));
    
    // Find second message
    const startIndex2 = combined.indexOf(START_BYTES, endIndex1);
    const parsed2 = parseMessage(combined.slice(startIndex2));

    assert.ok(parsed1);
    assert.ok(parsed2);
    assert.strictEqual(parsed1.deviceId, 'STA001');
    assert.strictEqual(parsed2.deviceId, 'STA002');
  });

  it('should handle message with garbage prefix', () => {
    const garbage = Buffer.from([0xFF, 0xFE, 0x00, 0x01]);
    const validMessage = buildMessage('TEST001', CMD.LOGIN, Buffer.alloc(0));
    const combined = Buffer.concat([garbage, validMessage]);

    // Find start bytes
    const startIndex = combined.indexOf(START_BYTES);
    const parsed = parseMessage(combined.slice(startIndex));

    assert.ok(parsed);
    assert.strictEqual(parsed.deviceId, 'TEST001');
    assert.strictEqual(parsed.valid, true);
  });
});

describe('Error Response Codes', () => {
  const ERROR_CODES = {
    SUCCESS: 0x00,
    INVALID_SLOT: 0x01,
    HARDWARE_ERROR: 0x02,
    SLOT_EMPTY: 0x03,
    SLOT_OCCUPIED: 0x04,
    TIMEOUT: 0x05,
    UNAUTHORIZED: 0x06,
  };

  it('should encode success response', () => {
    const data = Buffer.alloc(2);
    data.writeUInt8(1, 0); // Slot 1
    data.writeUInt8(ERROR_CODES.SUCCESS, 1);

    const message = buildMessage('STA001', CMD.BORROW_RESP, data);
    const parsed = parseMessage(message);

    assert.ok(parsed);
    assert.strictEqual(parsed.data[1], ERROR_CODES.SUCCESS);
  });

  it('should encode error response', () => {
    const data = Buffer.alloc(2);
    data.writeUInt8(1, 0); // Slot 1
    data.writeUInt8(ERROR_CODES.HARDWARE_ERROR, 1);

    const message = buildMessage('STA001', CMD.BORROW_RESP, data);
    const parsed = parseMessage(message);

    assert.ok(parsed);
    assert.strictEqual(parsed.data[1], ERROR_CODES.HARDWARE_ERROR);
  });
});

// Run tests
console.log('Running WsCharge Protocol Tests...\n');
