import 'server-only'

import { sessionRepository, stationRepository } from '@/lib/db'
import { stationManager } from '@/lib/wscharge'
import * as protocol from '@/lib/wscharge/protocol'
import { logger } from '@/lib/observability/logger'

const INVENTORY_SETTLE_MS = 2500

/** Query cabinet inventory (0x64) and wait for async DB sync via message ingress. */
export async function refreshCabinetInventory(
  dbStationId: string,
  productSn: string,
): Promise<void> {
  const result = await stationManager.sendCommand(
    productSn,
    protocol.CommandCode.QUERY_INVENTORY,
  )
  if (!result.success) {
    logger.warn('Inventory refresh command failed before borrow', {
      dbStationId,
      productSn,
      error: result.error,
    })
    return
  }
  await new Promise((resolve) => setTimeout(resolve, INVENTORY_SETTLE_MS))
  void dbStationId
}

/** Pick a slot that the cabinet reports as occupied (highest battery first). */
export async function resolvePickupSlot(
  dbStationId: string,
  preferredSlot?: number | null,
): Promise<number | null> {
  const station = await stationRepository.getById(dbStationId)
  if (!station?.slots?.length) return null

  const occupied = station.slots
    .filter((s) => {
      if (s.status !== 'occupied') return false
      if (s.power_bank_id) return true
      const meta = s.metadata as { terminal_external_id?: string } | null
      return Boolean(meta?.terminal_external_id)
    })
    .sort((a, b) => (b.battery_level ?? 0) - (a.battery_level ?? 0))

  if (!occupied.length) return null

  if (preferredSlot) {
    const match = occupied.find((s) => s.slot_number === preferredSlot)
    if (match) return match.slot_number
  }

  return occupied[0].slot_number
}

export async function dispatchForceEjectForSlot(
  dbStationId: string,
  productSn: string,
  slotNumber: number,
  sessionId: string,
  source: string,
): Promise<boolean> {
  const payload = Buffer.alloc(1)
  payload.writeUInt8(slotNumber, 0)
  const result = await stationManager.sendCommand(
    productSn,
    protocol.CommandCode.FORCE_EJECT,
    payload,
  )

  if (!result.success) return false

  await stationRepository.createCommand({
    station_id: dbStationId,
    command_type: 'force_eject',
    slot_number: slotNumber,
    payload: { source },
    status: 'sent',
    priority: 1,
    session_id: sessionId,
    metadata: { source },
  })

  await sessionRepository.addEvent(sessionId, {
    type: 'unlock',
    description: `Force eject fallback sent for slot ${slotNumber}`,
    metadata: { slotNumber, source },
  })

  return true
}
