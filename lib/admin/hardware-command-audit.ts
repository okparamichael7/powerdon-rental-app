import { stationRepository } from '@/lib/db/station-repository'
import { hardwareAuditRepository } from '@/lib/db/hardware-audit-repository'
import type { CommandType } from '@/lib/db/types'

const COMMAND_MAP: Record<string, CommandType> = {
  query_inventory: 'inventory',
  borrow: 'borrow',
  force_eject: 'force_eject',
  full_eject: 'force_eject',
  reboot: 'reboot',
  query_info: 'settings',
}

export async function resolveDbStationId(stationIdOrExternal: string): Promise<string | null> {
  const byId = await stationRepository.getById(stationIdOrExternal)
  if (byId) return byId.id
  const byExternal = await stationRepository.getByExternalId(stationIdOrExternal)
  return byExternal?.id ?? null
}

export async function auditAdminHardwareCommand(input: {
  actorUserId: string
  stationIdOrExternal: string
  command: string
  slotNumber?: number
  success: boolean
  error?: string
}): Promise<void> {
  const dbStationId = await resolveDbStationId(input.stationIdOrExternal)
  const commandType = COMMAND_MAP[input.command]

  if (dbStationId && commandType) {
    try {
      await stationRepository.createCommand({
        station_id: dbStationId,
        command_type: commandType,
        slot_number: input.slotNumber ?? null,
        triggered_by: input.actorUserId,
        status: input.success ? 'sent' : 'failed',
        payload: { source: 'admin_live_console', command: input.command },
        error_message: input.error ?? null,
      })
    } catch (err) {
      console.error('[Admin] hardware command persist:', err)
    }
  }

  if (!dbStationId) return

  try {
    await hardwareAuditRepository.log({
      actorAuthUserId: input.actorUserId,
      stationId: dbStationId,
      slotNumber: input.slotNumber ?? null,
      action: 'hardware.command',
      details: {
        command: input.command,
        success: input.success,
        error: input.error,
      },
    })
  } catch (err) {
    console.error('[Admin] hardware command audit:', err)
  }
}
