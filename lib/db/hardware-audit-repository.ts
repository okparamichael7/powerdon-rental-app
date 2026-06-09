import { createServiceClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/observability/logger'
import { isSchemaGapError } from '@/lib/db/schema-compat'

export type HardwareAuditAction =
  | 'hardware.create'
  | 'hardware.update'
  | 'hardware.archive'
  | 'hardware.delete'
  | 'hardware.slot.create'
  | 'hardware.slot.update'
  | 'hardware.slot.remove_blocked'
  | 'hardware.slot_count.increase'
  | 'hardware.slot_count.decrease'
  | 'hardware.maintenance.create'
  | 'hardware.restore'
  | 'hardware.command'

export interface DbHardwareAuditLog {
  id: string
  actor_auth_user_id: string | null
  station_id: string | null
  slot_number: number | null
  action: string
  details: Record<string, unknown>
  created_at: string
}

class HardwareAuditRepository {
  async log(input: {
    actorAuthUserId: string
    stationId?: string | null
    slotNumber?: number | null
    action: HardwareAuditAction
    details?: Record<string, unknown>
  }): Promise<void> {
    const supabase = await createServiceClient()
    const row: Record<string, unknown> = {
      action: input.action,
      details: input.details ?? {},
    }
    if (input.actorAuthUserId) row.actor_auth_user_id = input.actorAuthUserId
    if (input.stationId) row.station_id = input.stationId
    if (input.slotNumber != null) row.slot_number = input.slotNumber

    const { error } = await supabase.from('hardware_audit_log').insert(row)
    if (error) {
      if (isSchemaGapError(error)) {
        logger.warn('hardware_audit_log unavailable; skipping audit entry', {
          action: input.action,
          code: error.code,
          message: error.message,
        })
        return
      }
      throw error
    }
  }

  async listByStation(stationId: string, limit = 50): Promise<DbHardwareAuditLog[]> {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('hardware_audit_log')
      .select('*')
      .eq('station_id', stationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data ?? []) as DbHardwareAuditLog[]
  }

  async listRecent(limit = 50): Promise<DbHardwareAuditLog[]> {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('hardware_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data ?? []) as DbHardwareAuditLog[]
  }
}

export const hardwareAuditRepository = new HardwareAuditRepository()
