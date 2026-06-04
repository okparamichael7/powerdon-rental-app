import { createHash } from 'crypto'

/** Stable idempotency key for inbound hardware events (reconnect / retry safe). */
export function hardwareEventIdempotencyKey(params: {
  stationExternalId: string
  eventType: string
  messageHex: string
}): string {
  const raw = `${params.stationExternalId}:${params.eventType}:${params.messageHex}`
  return createHash('sha256').update(raw).digest('hex')
}
