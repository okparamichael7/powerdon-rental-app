import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CommandCode,
  PROTOCOL_TOKEN,
  LoginResult,
  ReturnResult,
  BorrowResult,
  buildMessage,
  parseMessage,
  parseLoginMessage,
  buildLoginResponse,
  buildHeartbeatResponse,
  buildBorrowCommand,
  parseBorrowResponse,
  buildReturnResponse,
  parseReturnMessage,
  calculateChecksum,
  extractMessages,
  validateProtocolToken,
  batteryLevelToPercent,
  BatteryLevel,
} from './protocol'

describe('WsCharge v5.8P protocol', () => {
  it('validates fixed token', () => {
    assert.equal(validateProtocolToken(PROTOCOL_TOKEN), true)
    assert.equal(validateProtocolToken(0), false)
  })

  it('round-trips login response', () => {
    const frame = buildLoginResponse(LoginResult.SUCCESS)
    const parsed = parseMessage(frame)
    assert.ok(parsed)
    assert.equal(parsed.command, CommandCode.LOGIN)
    assert.equal(parsed.token, PROTOCOL_TOKEN)
    assert.equal(parsed.payload.readUInt8(0), LoginResult.SUCCESS)
  })

  it('round-trips heartbeat response', () => {
    const frame = buildHeartbeatResponse()
    const parsed = parseMessage(frame)
    assert.ok(parsed)
    assert.equal(parsed.command, CommandCode.HEARTBEAT)
    assert.equal(parsed.payload.length, 0)
  })

  it('parses login request from cabinet', () => {
    const sn = 'PD123456'
    const snBytes = Buffer.from(`${sn}\0`, 'utf8')
    const payload = Buffer.alloc(8 + snBytes.length)
    payload.writeUInt32BE(0x12345678, 0)
    payload.writeUInt16BE(0xabcd, 4)
    payload.writeUInt16BE(snBytes.length, 6)
    snBytes.copy(payload, 8)

    const frame = buildMessage(CommandCode.LOGIN, payload)
    const parsed = parseMessage(frame)
    assert.ok(parsed)
    const login = parseLoginMessage(parsed)
    assert.ok(login)
    assert.equal(login.productSn, sn)
  })

  it('rejects bad checksum', () => {
    const frame = buildBorrowCommand(3)
    frame[4] = frame[4] ^ 0xff
    assert.equal(parseMessage(frame), null)
  })

  it('parses borrow response', () => {
    const payload = Buffer.alloc(10)
    payload.writeUInt8(2, 0)
    payload.writeUInt8(BorrowResult.SUCCESS, 1)
    Buffer.from('AABBCCDDEEFF0011', 'hex').copy(payload, 2)
    const frame = buildMessage(CommandCode.BORROW_POWERBANK, payload)
    const parsed = parseBorrowResponse(parseMessage(frame)!)
    assert.ok(parsed)
    assert.equal(parsed.slotNumber, 2)
    assert.equal(parsed.result, BorrowResult.SUCCESS)
  })

  it('builds return ack', () => {
    const frame = buildReturnResponse(4, ReturnResult.SUCCESS)
    const parsed = parseMessage(frame)
    assert.ok(parsed)
    assert.equal(parsed.payload.readUInt8(0), 4)
    assert.equal(parsed.payload.readUInt8(1), ReturnResult.SUCCESS)
  })

  it('extracts multiple frames from buffer', () => {
    const a = buildHeartbeatResponse()
    const b = buildLoginResponse(LoginResult.SUCCESS)
    const buf = Buffer.concat([a, b])
    const { messages, remaining } = extractMessages(buf)
    assert.equal(messages.length, 2)
    assert.equal(remaining.length, 0)
  })

  it('checksum XOR matches spec', () => {
    const payload = Buffer.from([0x01, 0x02, 0x03])
    assert.equal(calculateChecksum(payload), 0x01 ^ 0x02 ^ 0x03)
  })

  it('maps battery levels to percent', () => {
    assert.equal(batteryLevelToPercent(BatteryLevel.LEVEL_100), 100)
    assert.equal(batteryLevelToPercent(BatteryLevel.LEVEL_20), 20)
  })
})
