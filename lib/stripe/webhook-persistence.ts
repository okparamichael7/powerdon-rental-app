import { createServiceClient } from '@/lib/supabase/admin'
import { isSchemaGapError, missingColumnFromError } from '@/lib/db/schema-compat'
import { logger } from '@/lib/observability/logger'
import { isDuplicateWebhookEvent } from '@/lib/stripe/webhook-state-mappers'

export async function recordStripeWebhookEvent(
  eventId: string,
  eventType: string,
): Promise<{ ok: true; duplicate: boolean } | { ok: false; error: string; code?: string }> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('stripe_webhook_events').insert({
    event_id: eventId,
    event_type: eventType,
  })

  if (!error) {
    logger.info('Webhook event recorded', { eventId, eventType })
    return { ok: true, duplicate: false }
  }

  if (isDuplicateWebhookEvent(error.code)) {
    return { ok: true, duplicate: true }
  }

  logger.error('Webhook idempotency insert failed', {
    eventId,
    eventType,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  })

  const message =
    error.code === 'PGRST205' ||
    (error.message ?? '').includes('stripe_webhook_events') ||
    (error.message ?? '').includes('schema cache')
      ? 'stripe_webhook_events table missing or stale — run migration 005 in Supabase and reload the schema cache'
      : error.message

  return { ok: false, error: message, code: error.code }
}

export async function updateRentalSessionFromWebhook(
  sessionCode: string,
  update: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  let payload = { ...update }

  for (let attempt = 0; attempt < 10; attempt++) {
    const { error } = await supabase
      .from('rental_sessions')
      .update(payload)
      .eq('session_code', sessionCode)

    if (!error) return { ok: true }

    if (!isSchemaGapError(error)) {
      logger.error('Webhook rental session update failed', {
        sessionCode,
        code: error.code,
        message: error.message,
        attempt,
      })
      return { ok: false, error: error.message }
    }

    const col = missingColumnFromError(error.message ?? '')
    if (col && col in payload) {
      delete payload[col]
      continue
    }
    if ('metadata' in payload) {
      delete payload.metadata
      continue
    }
    return { ok: false, error: error.message }
  }

  return { ok: false, error: 'Webhook rental session update exceeded schema fallback retries' }
}
