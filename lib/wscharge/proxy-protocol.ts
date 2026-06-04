/**
 * High-level protocol adapter for the standalone TCP proxy server.
 * Maps WsCharge binary frames to JSON-friendly message types.
 */
import {
  CommandCode,
  LoginResult,
  ReturnResult,
  BorrowResult,
  parseMessage,
  parseLoginMessage,
  parseInventoryResponse,
  parseBorrowResponse,
  parseReturnMessage,
  buildLoginResponse,
  buildHeartbeatResponse,
  buildBorrowCommand,
  buildReturnResponse,
  buildMessage,
  batteryLevelToPercent,
} from './protocol'

export type ProxyMessageType =
  | 'login'
  | 'heartbeat'
  | 'inventory_report'
  | 'borrow_result'
  | 'return_detected'
  | 'error'
  | 'unknown'

export interface DecodedProxyMessage {
  type: ProxyMessageType
  data: Record<string, unknown>
}

export type ProxyEncodeType =
  | 'login_response'
  | 'heartbeat_response'
  | 'inventory_response'
  | 'return_response'
  | 'borrow'
  | 'force_eject'

export const MessageType = {
  LOGIN: 'login',
  HEARTBEAT: 'heartbeat',
  INVENTORY_REPORT: 'inventory_report',
  BORROW_RESULT: 'borrow_result',
  RETURN_DETECTED: 'return_detected',
} as const

export class WsChargeProtocol {
  static decode(message: Buffer): DecodedProxyMessage {
    const parsed = parseMessage(message)
    if (!parsed) {
      return { type: 'error', data: { code: 'PARSE_ERROR', message: 'Invalid frame' } }
    }

    switch (parsed.command) {
      case CommandCode.LOGIN: {
        const login = parseLoginMessage(parsed)
        return {
          type: 'login',
          data: {
            stationId: login?.productSn ?? '',
            iccid: '',
            firmwareVersion: '',
            slots: [],
          },
        }
      }
      case CommandCode.HEARTBEAT:
        return { type: 'heartbeat', data: { timestamp: new Date().toISOString() } }
      case CommandCode.QUERY_INVENTORY: {
        const inv = parseInventoryResponse(parsed)
        return {
          type: 'inventory_report',
          data: {
            slots: (inv?.slots ?? []).map((s) => ({
              slotNumber: s.slotNumber,
              terminalId: s.terminalId,
              batteryLevel: batteryLevelToPercent(s.batteryLevel),
              status: 'occupied',
            })),
          },
        }
      }
      case CommandCode.BORROW_POWERBANK: {
        const borrow = parseBorrowResponse(parsed)
        return {
          type: 'borrow_result',
          data: {
            slotNumber: borrow?.slotNumber,
            success: borrow?.result === BorrowResult.SUCCESS,
            powerBankId: borrow?.terminalId,
            result: borrow?.result,
          },
        }
      }
      case CommandCode.RETURN_POWERBANK: {
        const ret = parseReturnMessage(parsed)
        return {
          type: 'return_detected',
          data: {
            slotNumber: ret?.slotNumber,
            powerBankId: ret?.terminalId,
            batteryLevel: 100,
          },
        }
      }
      default:
        return { type: 'unknown', data: { command: parsed.command } }
    }
  }

  static encode(input: { type: ProxyEncodeType | string; data?: Record<string, unknown> }): Buffer {
    switch (input.type) {
      case 'login_response':
        return buildLoginResponse(LoginResult.SUCCESS)
      case 'heartbeat_response':
        return buildHeartbeatResponse()
      case 'inventory_response':
        return buildMessage(CommandCode.QUERY_INVENTORY)
      case 'return_response': {
        const slot = Number(input.data?.slotNumber ?? 0)
        return buildReturnResponse(slot, ReturnResult.SUCCESS)
      }
      case 'borrow': {
        const slot = Number(input.data?.slotNumber ?? 1)
        return buildBorrowCommand(slot)
      }
      case 'force_eject': {
        const slot = Number(input.data?.slotNumber ?? 0)
        return buildBorrowCommand(slot)
      }
      default:
        return buildHeartbeatResponse()
    }
  }
}
