import 'server-only'

import { sessionRepository, stationRepository } from '@/lib/db'
import { stationManager } from '@/lib/wscharge'
import * as protocol from '@/lib/wscharge/protocol'
import { logger } from '@/lib/observability/logger'
import {
  canDispatchHardwareToStation,
  shouldSkipBorrowDispatch,
} from '@/lib/rental/hardware-dispatch-guard'

export interface DispatchBorrowResult {
  success: boolean
  skipped?: boolean
  error?: string
}

/**
 * Send WsCharge borrow (0x65) for a pending rental session after payment / start.
 * Idempotent: skips if a borrow command was already recorded for this session.
 */
export async function dispatchBorrowForSession(
  sessionId: string,
): Promise<DispatchBorrowResult> {
  const session = await sessionRepository.getById(sessionId)
  if (!session) {
    return { success: false, error: 'Session not found' }
  }

  if (!['pending', 'active'].includes(session.status)) {
    return { success: false, skipped: true, error: 'Session not eligible for borrow' }
  }

  const station = await stationRepository.getById(session.pickup_station_id)
  if (!station) {
    return { success: false, error: 'Station not found' }
  }

  const dispatchGuard = canDispatchHardwareToStation(station)
  if (!dispatchGuard.allowed) {
    return { success: false, error: dispatchGuard.error }
  }

  const productSn = station.external_id
  if (!productSn) {
    return { success: false, error: 'Station has no hardware external_id' }
  }

  const events = await sessionRepository.getEvents(session.id)
  if (shouldSkipBorrowDispatch(session, events)) {
    return { success: true, skipped: true }
  }

  const slot = session.pickup_slot_number
  if (!slot) {
    return { success: false, error: 'No pickup slot on session' }
  }

  try {
    const payload = Buffer.alloc(1)
    payload.writeUInt8(slot, 0)
    const result = await stationManager.sendCommand(
      productSn,
      protocol.CommandCode.BORROW_POWERBANK,
      payload,
    )

    if (result.success) {
      await stationRepository.createCommand({
        station_id: station.id,
        command_type: 'borrow',
        slot_number: slot,
        payload: { sessionCode: session.session_code },
        status: 'sent',
        priority: 1,
        session_id: session.id,
        metadata: { source: 'dispatch-borrow' },
      })

      await sessionRepository.addEvent(session.id, {
        type: 'unlock',
        description: `Unlock command sent for slot ${slot}`,
        metadata: { slotNumber: slot, source: 'dispatch-borrow' },
      })
    }

    return {
      success: result.success,
      error: result.success ? undefined : result.error ?? 'Borrow dispatch failed',
    }
  } catch (error) {
    logger.error('dispatchBorrowForSession failed', {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'Borrow dispatch error' }
  }
}

export async function dispatchBorrowBySessionCode(sessionCode: string): Promise<DispatchBorrowResult> {
  const session = await sessionRepository.getByCode(sessionCode)
  if (!session) return { success: false, error: 'Session not found' }
  return dispatchBorrowForSession(session.id)
}
