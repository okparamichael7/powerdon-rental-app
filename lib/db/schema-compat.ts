import type { DbReward } from './types'

/** Treat blank strings as absent for optional UUID columns (Postgres rejects ""). */
export function nullIfEmptyUuid(value: string | null | undefined): string | undefined {
  if (value == null) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/** Parse missing column name from PostgREST / Postgres schema errors. */
export function missingColumnFromError(message: string): string | null {
  const cache = message.match(/Could not find the '([^']+)' column/)
  if (cache?.[1]) return cache[1]
  const pg = message.match(/column "([^"]+)" of relation/)
  if (pg?.[1]) return pg[1]
  const pg2 = message.match(/column "([^"]+)" does not exist/)
  if (pg2?.[1]) return pg2[1]
  return null
}

/** Detect PostgREST / Postgres errors from an incomplete rental_sessions schema. */
export function isSchemaGapError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === 'PGRST200' || error.code === 'PGRST204' || error.code === '42703') return true
  const msg = error.message ?? ''
  return (
    msg.includes('does not exist') ||
    msg.includes('Could not find a relationship') ||
    msg.includes('Could not find') ||
    msg.includes('schema cache')
  )
}

export const SESSION_SELECT_FULL = `
  *,
  user:users(*),
  pickup_station:stations!pickup_station_id(id, name, location),
  return_station:stations!return_station_id(id, name, location),
  reward:rewards!session_id(code, id, status)
`

export const SESSION_SELECT_MINIMAL = `
  *,
  user:users(*),
  reward:rewards!session_id(code, id, status)
`

export async function queryWithSchemaFallback<T>(
  fullSelect: string,
  minimalSelect: string,
  run: (select: string) => Promise<{ data: T | null; error: { code?: string; message?: string } | null }>,
): Promise<T> {
  let { data, error } = await run(fullSelect)
  if (error && isSchemaGapError(error)) {
    ;({ data, error } = await run(minimalSelect))
  }
  if (error) throw error
  return data as T
}

/** Map partial rewards rows (reward_value, no issued_at) to DbReward. */
export function normalizeRewardRow(row: Record<string, unknown>): DbReward {
  const createdAt = String(row.created_at ?? new Date().toISOString())
  return {
    id: String(row.id),
    code: String(row.code ?? ''),
    session_id: String(row.session_id),
    user_id: String(row.user_id),
    campaign_id: String(row.campaign_id),
    reward_type: String(row.reward_type ?? 'voucher'),
    value: Number(row.value ?? row.reward_value ?? 0),
    description: row.description != null ? String(row.description) : null,
    status: row.status as DbReward['status'],
    issued_at: String(row.issued_at ?? createdAt),
    expires_at: String(row.expires_at ?? createdAt),
    redeemed_at: row.redeemed_at != null ? String(row.redeemed_at) : null,
    redemption_location: row.redemption_location != null ? String(row.redemption_location) : null,
    redeemed_by_staff_id:
      row.redeemed_by_staff_id != null ? String(row.redeemed_by_staff_id) : null,
    metadata: (row.metadata ?? {}) as DbReward['metadata'],
    created_at: createdAt,
    updated_at: String(row.updated_at ?? createdAt),
  }
}

export function normalizeRewardRows(rows: Record<string, unknown>[] | null): DbReward[] {
  return (rows ?? []).map(normalizeRewardRow)
}
