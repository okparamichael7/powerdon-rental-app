import { createServiceClient } from '@/lib/supabase/admin'
import { mutateWithSchemaFallback } from './schema-compat'
import type { DbPowerBank } from './types'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const EMPTY_TERMINAL_RE = /^0+$/

export function isPowerBankUuid(value: string): boolean {
  return UUID_RE.test(value.trim())
}

/** Normalize WsCharge 8-byte terminal ID hex for power_banks.external_id. */
export function normalizeTerminalExternalId(terminalId: string): string | null {
  const key = terminalId.trim().replace(/:/g, '').toUpperCase()
  if (!key || EMPTY_TERMINAL_RE.test(key)) return null
  return key
}

export class PowerBankRepository {
  async getById(id: string): Promise<DbPowerBank | null> {
    if (!isPowerBankUuid(id)) return null
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('power_banks')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data
  }

  async getByExternalId(externalId: string): Promise<DbPowerBank | null> {
    const normalized = normalizeTerminalExternalId(externalId) ?? externalId.trim()
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('power_banks')
      .select('*')
      .eq('external_id', normalized)
      .maybeSingle()
    if (error) throw error
    return data
  }

  /**
   * Resolve WsCharge terminal hex or power_banks.id UUID to a DB UUID.
   * Creates power_banks row on first sighting (same pattern as station-resolve).
   */
  async resolveDbPowerBankId(
    terminalOrUuid: string,
    ctx?: {
      stationId?: string
      slotNumber?: number
      batteryLevel?: number
    },
  ): Promise<string | null> {
    const key = terminalOrUuid?.trim()
    if (!key) return null

    if (isPowerBankUuid(key)) {
      const byId = await this.getById(key)
      return byId?.id ?? null
    }

    return this.ensureByTerminalId(key, ctx)
  }

  async ensureByTerminalId(
    terminalId: string,
    ctx?: {
      stationId?: string
      slotNumber?: number
      batteryLevel?: number
    },
  ): Promise<string | null> {
    const externalId = normalizeTerminalExternalId(terminalId)
    if (!externalId) return null

    const existing = await this.getByExternalId(externalId)
    if (existing) {
      if (ctx?.stationId || ctx?.batteryLevel != null) {
        await this.update(existing.id, {
          current_station_id: ctx.stationId ?? existing.current_station_id,
          current_slot_number: ctx.slotNumber ?? existing.current_slot_number,
          battery_level: ctx.batteryLevel ?? existing.battery_level,
          status: 'available',
        })
      }
      return existing.id
    }

    const supabase = await createServiceClient()
    try {
      const row = await mutateWithSchemaFallback<{ id: string }>(
        {
          external_id: externalId,
          // Legacy v0 partial DBs: power_banks.device_id NOT NULL (terminal hex).
          device_id: externalId,
          status: 'available',
          current_station_id: ctx?.stationId ?? null,
          current_slot_number: ctx?.slotNumber ?? null,
          battery_level: ctx?.batteryLevel ?? null,
        },
        async (payload) => {
          const { data, error } = await supabase
            .from('power_banks')
            .insert(payload)
            .select('id')
            .single()
          return { data, error }
        },
      )
      return row.id
    } catch (error) {
      const code = (error as { code?: string })?.code
      if (code === '23505') {
        const existing = await this.getByExternalId(externalId)
        return existing?.id ?? null
      }
      throw error
    }
  }

  async update(id: string, updates: Partial<DbPowerBank>): Promise<void> {
    const supabase = await createServiceClient()
    const { error } = await supabase
      .from('power_banks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }
}

export const powerBankRepository = new PowerBankRepository()
