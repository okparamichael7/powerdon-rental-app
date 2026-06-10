import type { DbRentalSession, DbStation } from '@/lib/db/types'
import { getWsChargeConfig } from '@/lib/wscharge/config'
import { logger } from '@/lib/observability/logger'

/** Whether borrow/unlock commands may be sent to this station. */
export function canDispatchHardwareToStation(station: Pick<DbStation, 'id' | 'external_id' | 'status'>): {
  allowed: boolean
  error?: string
} {
  if (!station.external_id) {
    return { allowed: false, error: 'Station has no hardware external_id' }
  }

  const { proxyUrl } = getWsChargeConfig()
  if (station.status !== 'online' && !proxyUrl) {
    return { allowed: false, error: 'Station offline' }
  }

  if (station.status !== 'online' && proxyUrl) {
    logger.warn('Attempting hardware dispatch while DB station status is not online', {
      stationId: station.id,
      externalId: station.external_id,
      dbStatus: station.status,
    })
  }

  return { allowed: true }
}

/** Skip only when the power bank was already dispensed. */
export function shouldSkipBorrowDispatch(
  session: Pick<DbRentalSession, 'status'>,
  events: Array<{ event_type: string }>,
): boolean {
  if (session.status === 'active') return true
  return events.some((e) => e.event_type === 'pickup')
}
