/**
 * Central WsCharge v5.8P message processor (HTTP ingress + tests).
 */

import * as protocol from './protocol'
import { stationManager } from './station-manager'
import { hardwareEventIdempotencyKey } from './idempotency'
import {
  incrementWsChargeMetric,
  recordWsChargeLatency,
} from './metrics'
import { stationRepository, sessionRepository, rewardRepository } from '@/lib/db'
import type { SlotStatus, Json } from '@/lib/db/types'

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json
}

export interface ProcessWsChargeInput {
  messageHex: string
  stationId?: string
  connectionId?: string
  remoteAddress?: string
  correlationId?: string
}

export interface WsChargeResponseItem {
  command: string
  responseHex: string
  data?: Record<string, unknown>
}

export interface ProcessWsChargeResult {
  success: boolean
  stationId?: string
  dbStationId?: string | null
  connectionId?: string
  messagesProcessed: number
  responses: WsChargeResponseItem[]
  remainingBytes: string | null
  error?: string
}

async function logEventSafe(
  event: Parameters<typeof stationRepository.logHardwareEvent>[0],
  idempotencyKey?: string
): Promise<void> {
  try {
    if (idempotencyKey) {
      await stationRepository.logHardwareEventIdempotent({
        ...event,
        idempotency_key: idempotencyKey,
      })
      return
    }
    await stationRepository.logHardwareEvent(event)
  } catch (err) {
    const code = (err as { code?: string })?.code
    if (code === '23505') {
      incrementWsChargeMetric('idempotent_skips')
      return
    }
    console.error('[WsCharge] Failed to log hardware event:', err)
  }
}

export async function processWsChargeHex(
  input: ProcessWsChargeInput
): Promise<ProcessWsChargeResult> {
  const started = performance.now()
  const { messageHex, connectionId, remoteAddress, correlationId } = input
  let currentStationId = input.stationId
  let dbStationId: string | null = null

  const messageBuffer = Buffer.from(messageHex, 'hex')
  const { messages, remaining } = protocol.extractMessages(messageBuffer)
  incrementWsChargeMetric('messages_received', messages.length)

  const responses: WsChargeResponseItem[] = []

  for (const message of messages) {
    if (!protocol.validateProtocolToken(message.token)) {
      incrementWsChargeMetric('token_failures')
      continue
    }

    let responseBuffer: Buffer | null = null
    let responseData: Record<string, unknown> | undefined
    const frameHex = messageHex

    switch (message.command) {
      case protocol.CommandCode.LOGIN: {
        const loginMsg = protocol.parseLoginMessage(message)
        if (!loginMsg) break
        currentStationId = loginMsg.productSn
        const { response } = stationManager.handleLogin(loginMsg)
        responseBuffer = response

        try {
          const station = await stationRepository.registerFromHardware(loginMsg.productSn, {
            connectionIp: remoteAddress,
          })
          dbStationId = station.id
          stationManager.linkDbId(station.id, loginMsg.productSn)
          const idem = hardwareEventIdempotencyKey({
            stationExternalId: loginMsg.productSn,
            eventType: 'login',
            messageHex: frameHex,
          })
          await logEventSafe(
            {
              station_id: station.id,
              station_external_id: loginMsg.productSn,
              event_type: 'login',
              direction: 'inbound',
              raw_data: frameHex,
              correlation_id: correlationId,
              parsed_data: toJson({
                productSn: loginMsg.productSn,
                random: loginMsg.random,
                magic: loginMsg.magic,
                correlationId,
              }),
            },
            idem
          )
          incrementWsChargeMetric('connections_login_success')
        } catch (dbError) {
          incrementWsChargeMetric('connections_login_failure')
          console.error('[DB] Error registering station:', dbError)
        }

        responseData = {
          stationId: loginMsg.productSn,
          dbStationId,
          action: 'login',
          result: 'success',
        }
        break
      }

      case protocol.CommandCode.HEARTBEAT: {
        if (!currentStationId) break
        responseBuffer = stationManager.handleHeartbeat(currentStationId)
        if (!dbStationId && currentStationId) {
          const row = await stationRepository.getByExternalId(currentStationId)
          dbStationId = row?.id ?? null
        }
        if (dbStationId) {
          await stationRepository.updateHeartbeat(dbStationId, {
            connectionIp: remoteAddress,
          })
        }
        responseData = { stationId: currentStationId, action: 'heartbeat' }
        break
      }

      case protocol.CommandCode.QUERY_INVENTORY: {
        if (!currentStationId) break
        const inventoryResponse = protocol.parseInventoryResponse(message)
        if (!inventoryResponse) break
        stationManager.handleInventoryResponse(currentStationId, inventoryResponse)

        if (!dbStationId && currentStationId) {
          const row = await stationRepository.getByExternalId(currentStationId)
          dbStationId = row?.id ?? null
        }

        if (dbStationId && inventoryResponse.slots) {
          const inventory = inventoryResponse.slots.map((slot) => ({
            slotNumber: slot.slotNumber,
            status: (slot.terminalId && slot.terminalId !== '0000000000000000'
              ? 'occupied'
              : 'empty') as SlotStatus,
            batteryLevel: protocol.batteryLevelToPercent(slot.batteryLevel),
            powerBankId: slot.terminalId || undefined,
            isCharging: false,
          }))
          await stationRepository.updateInventory(dbStationId, inventory)
          await logEventSafe(
            {
              station_id: dbStationId,
              event_type: 'inventory',
              direction: 'inbound',
              raw_data: frameHex,
              parsed_data: toJson({ slotCount: inventoryResponse.slots.length }),
            },
            hardwareEventIdempotencyKey({
              stationExternalId: currentStationId,
              eventType: 'inventory',
              messageHex: frameHex,
            })
          )
        }

        responseData = {
          stationId: currentStationId,
          action: 'inventory_updated',
          slotCount: inventoryResponse.remainingCount,
        }
        break
      }

      case protocol.CommandCode.RETURN_POWERBANK: {
        if (!currentStationId) break
        const returnMsg = protocol.parseReturnMessage(message)
        if (!returnMsg) break
        responseBuffer = stationManager.handleReturn(currentStationId, returnMsg)

        if (!dbStationId && currentStationId) {
          const row = await stationRepository.getByExternalId(currentStationId)
          dbStationId = row?.id ?? null
        }

        if (dbStationId) {
          await processReturn(dbStationId, returnMsg)
          await logEventSafe(
            {
              station_id: dbStationId,
              event_type: 'return',
              direction: 'inbound',
              raw_data: frameHex,
              parsed_data: toJson(returnMsg),
            },
            hardwareEventIdempotencyKey({
              stationExternalId: currentStationId,
              eventType: 'return',
              messageHex: frameHex,
            })
          )
        }

        responseData = {
          stationId: currentStationId,
          action: 'powerbank_returned',
          slotNumber: returnMsg.slotNumber,
          terminalId: returnMsg.terminalId,
        }
        break
      }

      case protocol.CommandCode.BORROW_POWERBANK: {
        if (!currentStationId) break
        const borrowResponse = protocol.parseBorrowResponse(message)
        if (!borrowResponse) break
        stationManager.handleBorrowResponse(currentStationId, borrowResponse)

        if (!dbStationId && currentStationId) {
          const row = await stationRepository.getByExternalId(currentStationId)
          dbStationId = row?.id ?? null
        }

        if (dbStationId) {
          await processBorrowResult(dbStationId, borrowResponse)
          await logEventSafe(
            {
              station_id: dbStationId,
              event_type: 'borrow',
              direction: 'inbound',
              raw_data: frameHex,
              parsed_data: toJson(borrowResponse),
            },
            hardwareEventIdempotencyKey({
              stationExternalId: currentStationId,
              eventType: 'borrow',
              messageHex: frameHex,
            })
          )
        }

        responseData = {
          stationId: currentStationId,
          action: 'borrow_response',
          slotNumber: borrowResponse.slotNumber,
          success: borrowResponse.result === protocol.BorrowResult.SUCCESS,
          terminalId: borrowResponse.terminalId,
        }
        break
      }

      case protocol.CommandCode.FORCE_EJECT:
      case protocol.CommandCode.STACKED_FULL_EJECT: {
        if (!currentStationId) break
        const ejectResponse =
          message.command === protocol.CommandCode.STACKED_FULL_EJECT
            ? protocol.parseStackedEjectResponse(message)
            : protocol.parseForceEjectResponse(message)
        if (!ejectResponse) break
        stationManager.handleForceEjectResponse(currentStationId, ejectResponse)

        if (!dbStationId && currentStationId) {
          const row = await stationRepository.getByExternalId(currentStationId)
          dbStationId = row?.id ?? null
        }

        if (dbStationId) {
          await logEventSafe(
            {
              station_id: dbStationId,
              event_type: 'force_eject',
              direction: 'inbound',
              raw_data: frameHex,
              parsed_data: toJson(ejectResponse),
            },
            hardwareEventIdempotencyKey({
              stationExternalId: currentStationId,
              eventType: 'force_eject',
              messageHex: frameHex,
            })
          )
        }

        responseData = {
          stationId: currentStationId,
          action: 'force_eject_response',
          slotNumber: ejectResponse.slotNumber,
          success: ejectResponse.result === protocol.BorrowResult.SUCCESS,
        }
        break
      }

      case protocol.CommandCode.QUERY_NETWORK_INFO: {
        const net = protocol.parseNetworkInfoResponse(message)
        if (net && currentStationId) {
          const conn = stationManager.getStation(currentStationId)
          if (conn) conn.signalStrength = net.signalStrength
          responseData = { stationId: currentStationId, action: 'network_info', ...net }
        }
        break
      }

      case protocol.CommandCode.QUERY_ICCID: {
        const iccid = protocol.parseIccidResponse(message)
        if (iccid && currentStationId) {
          const conn = stationManager.getStation(currentStationId)
          if (conn) conn.iccid = iccid.iccid
          responseData = { stationId: currentStationId, action: 'iccid', iccid: iccid.iccid }
        }
        break
      }

      case protocol.CommandCode.QUERY_VERSION: {
        const ver = protocol.parseVersionResponse(message)
        if (ver && currentStationId) {
          const conn = stationManager.getStation(currentStationId)
          if (conn) conn.firmwareVersion = ver.version
          responseData = { stationId: currentStationId, action: 'version', version: ver.version }
        }
        break
      }

      case protocol.CommandCode.QUERY_SERVER_ADDRESS: {
        const addr = protocol.parseServerAddressResponse(message)
        if (addr) {
          responseData = { stationId: currentStationId, action: 'server_address', ...addr }
        }
        break
      }

      case protocol.CommandCode.STACKED_QUERY_CARD: {
        const stacked = protocol.parseStackedCardCountResponse(message)
        if (stacked) {
          responseData = { stationId: currentStationId, action: 'stacked_card_count', ...stacked }
        }
        break
      }

      default:
        console.log('[WsCharge] Unhandled command:', message.command.toString(16))
    }

    if (responseBuffer) {
      incrementWsChargeMetric('messages_sent')
      responses.push({
        command: protocol.CommandCode[message.command] || `0x${message.command.toString(16)}`,
        responseHex: responseBuffer.toString('hex'),
        data: responseData,
      })
    } else if (responseData) {
      responses.push({
        command: protocol.CommandCode[message.command] || `0x${message.command.toString(16)}`,
        responseHex: '',
        data: responseData,
      })
    }
  }

  recordWsChargeLatency(Math.round(performance.now() - started))

  return {
    success: true,
    stationId: currentStationId,
    dbStationId,
    connectionId,
    messagesProcessed: messages.length,
    responses,
    remainingBytes: remaining.length > 0 ? remaining.toString('hex') : null,
  }
}

async function processBorrowResult(
  stationId: string,
  borrowResponse: {
    slotNumber: number
    result: number
    terminalId?: string
    orderNumber?: string
  }
) {
  const success = borrowResponse.result === protocol.BorrowResult.SUCCESS
  const { slotNumber, terminalId } = borrowResponse

  const sessions = await sessionRepository.getAll({
    stationId,
    status: ['pending'],
    limit: 10,
  })

  const session = sessions.find(
    (s) => s.pickup_station_id === stationId && s.pickup_slot_number === slotNumber
  )

  if (!session) {
    console.warn('[Borrow] No pending session found for:', { stationId, slotNumber })
    return
  }

  if (success) {
    await sessionRepository.startSession(session.id, terminalId)
    await stationRepository.updateSlot(stationId, slotNumber, {
      status: 'empty',
      power_bank_id: null,
    })
    await sessionRepository.addEvent(session.id, {
      type: 'pickup',
      description: `Power bank ${terminalId || 'unknown'} picked up from slot ${slotNumber}`,
      metadata: { slotNumber, powerBankId: terminalId },
    })
  } else {
    await sessionRepository.update(session.id, {
      status: 'failed',
      payment_status: 'cancelled',
      metadata: {
        failureReason: 'hardware_unlock_failed',
        borrowResult: borrowResponse.result,
      },
    })
    await stationRepository.updateSlot(stationId, slotNumber, {
      status: 'occupied',
    })
    await sessionRepository.addEvent(session.id, {
      type: 'error',
      description: `Failed to unlock slot ${slotNumber}: error code ${borrowResponse.result}`,
      metadata: { slotNumber, errorCode: borrowResponse.result },
    })
  }
}

async function processReturn(
  stationId: string,
  returnMsg: {
    slotNumber: number
    terminalId?: string
    batteryLevel?: number
  }
) {
  const { slotNumber, terminalId, batteryLevel } = returnMsg

  await stationRepository.updateSlot(stationId, slotNumber, {
    status: 'occupied',
    power_bank_id: terminalId,
    battery_level: batteryLevel,
    is_charging: true,
  })

  if (!terminalId) return

  const activeSessions = await sessionRepository.getAll({
    status: ['active'],
    limit: 100,
  })

  const session = activeSessions.find((s) => s.power_bank_id === terminalId)
  if (!session) return

  const startedAt = session.started_at
    ? new Date(session.started_at)
    : new Date(session.created_at)
  const now = new Date()
  const durationMinutes = Math.floor((now.getTime() - startedAt.getTime()) / 60000)
  const hourlyCharge = (durationMinutes / 60) * session.hourly_rate
  const amountCharged = Math.min(hourlyCharge, session.daily_cap)
  const amountRefunded = session.deposit_amount
  const rewardQualified = session.reward_threshold_minutes
    ? durationMinutes >= session.reward_threshold_minutes
    : false

  await sessionRepository.completeSession(session.id, {
    returnStationId: stationId,
    returnSlotNumber: slotNumber,
    durationMinutes,
    amountCharged: Math.round(amountCharged * 100) / 100,
    amountRefunded,
    rewardQualified,
  })

  await sessionRepository.addEvent(session.id, {
    type: 'return',
    description: `Power bank returned to slot ${slotNumber}`,
    metadata: {
      stationId,
      slotNumber,
      batteryLevel,
      durationMinutes,
      amountCharged: Math.round(amountCharged * 100) / 100,
    },
  })

  if (rewardQualified && session.campaign_id) {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)
    try {
      const reward = await rewardRepository.create({
        sessionId: session.id,
        userId: session.user_id,
        campaignId: session.campaign_id,
        rewardType: 'voucher',
        value: 10,
        description: 'Thank you for using PowerDon!',
        expiresAt,
      })
      await sessionRepository.update(session.id, {
        reward_id: reward.id,
        reward_status: 'qualified',
      })
    } catch (rewardError) {
      console.error('[Return] Error creating reward:', rewardError)
    }
  }
}
