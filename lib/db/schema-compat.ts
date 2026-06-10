import type { DbReward } from './types'

/** Treat blank strings as absent for optional UUID columns (Postgres rejects ""). */
export function nullIfEmptyUuid(value: string | null | undefined): string | undefined {
  if (value == null) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const REQUIRED_SESSION_UUID_KEYS = new Set(['user_id', 'pickup_station_id'])

/** Remove blank optional *_id fields before rental_sessions insert. */
export function stripEmptyUuidFields(payload: Record<string, unknown>): Record<string, unknown> {
  const next = { ...payload }
  for (const [key, value] of Object.entries(next)) {
    if (REQUIRED_SESSION_UUID_KEYS.has(key)) continue
    if (!key.endsWith('_id')) continue
    if (value == null) {
      delete next[key]
      continue
    }
    if (typeof value === 'string') {
      const normalized = nullIfEmptyUuid(value)
      if (normalized) next[key] = normalized
      else delete next[key]
    }
  }
  return next
}

/** Postgres rejects "" for UUID columns (22P02). */
export function isInvalidUuidInputError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '22P02') return true
  return (error.message ?? '').includes('invalid input syntax for type uuid')
}

/** Legacy DBs may omit enum variants (e.g. session_status without expired). */
export function isInvalidEnumInputError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code !== '22P02') return false
  const msg = error.message ?? ''
  return msg.includes('invalid input value for enum') || msg.includes('enum')
}

/** Drop enum values that legacy schemas often lack. */
export function filterLegacySessionStatuses(statuses: string[]): string[] {
  return statuses.filter((s) => s !== 'expired')
}

type CountQueryError = { code?: string; message?: string } | null

/** Retry count queries when legacy session_status omits enum variants like expired. */
export async function countWithSessionStatusFallback(
  statuses: string[],
  run: (statuses: string[]) => Promise<{ count: number | null; error: CountQueryError }>,
): Promise<number> {
  const attempts = statuses.includes('expired')
    ? [statuses, filterLegacySessionStatuses(statuses)]
    : [statuses]

  let lastError: CountQueryError = null
  for (const attempt of attempts) {
    if (attempt.length === 0) continue
    const { count, error } = await run(attempt)
    if (!error) return count ?? 0
    if (isInvalidEnumInputError(error)) {
      lastError = error
      continue
    }
    throw error
  }

  if (lastError) throw lastError
  return 0
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
  pickup_station:stations!pickup_station_id(id, name),
  return_station:stations!return_station_id(id, name),
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

/** Omit null/undefined keys so PostgREST does not reference absent columns. */
export function compactRecord(payload: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (value !== null && value !== undefined) {
      next[key] = value
    }
  }
  return next
}

const FK_STRIP_KEYS = new Set(['created_by', 'updated_by', 'actor_auth_user_id', 'campaign_id'])

function shouldStripForFkViolation(message: string, key: string): boolean {
  if (!FK_STRIP_KEYS.has(key)) return false
  const lower = message.toLowerCase()
  return lower.includes(key) || lower.includes(key.replace(/_/g, ''))
}

type DbMutationError = { code?: string; message?: string } | null

/**
 * Retry inserts/updates on partial schemas: drop unknown columns and optional FK fields.
 */
export async function mutateWithSchemaFallback<T>(
  initialPayload: Record<string, unknown>,
  run: (payload: Record<string, unknown>) => Promise<{ data: T | null; error: DbMutationError }>,
  maxAttempts = 24,
): Promise<T> {
  let payload = compactRecord(initialPayload)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await run(payload)
    if (!error) {
      if (data == null) {
        throw new Error('Database mutation succeeded without returning a row')
      }
      return data
    }

    if (error.code === '23505') throw error

    if (isSchemaGapError(error)) {
      const col = missingColumnFromError(error.message ?? '')
      if (col && col in payload) {
        delete payload[col]
        continue
      }
    }

    if (error.code === '23503') {
      const msg = error.message ?? ''
      let stripped = false
      for (const key of FK_STRIP_KEYS) {
        if (key in payload && shouldStripForFkViolation(msg, key)) {
          delete payload[key]
          stripped = true
        }
      }
      if (stripped) continue
    }

    throw error
  }

  throw new Error('Database mutation exceeded schema fallback retries')
}
