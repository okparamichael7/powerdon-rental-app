import { stationRepository } from './station-repository'

const STATION_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True when value is a Postgres UUID (not a WsCharge product serial). */
export function isStationUuid(value: string): boolean {
  return STATION_UUID_RE.test(value.trim())
}

/**
 * Resolve a database station UUID from either a UUID or WsCharge external_id (product SN).
 * Never queries stations.id with a non-UUID string (avoids Postgres 22P02).
 */
export async function resolveDbStationId(stationIdOrExternal: string): Promise<string | null> {
  const key = stationIdOrExternal.trim()
  if (!key) return null

  if (isStationUuid(key)) {
    const byId = await stationRepository.getById(key)
    if (byId) return byId.id
  }

  const byExternal = await stationRepository.getByExternalId(key)
  return byExternal?.id ?? null
}
