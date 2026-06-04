-- Enterprise hardening: concurrency, indexes, webhook idempotency
-- Safe for partial databases (rewards may exist without all columns from 001).

-- ---------------------------------------------------------------------------
-- Ensure columns exist before indexing
-- ---------------------------------------------------------------------------

ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255);

ALTER TABLE rewards ADD COLUMN IF NOT EXISTS code VARCHAR(50);

UPDATE rewards
SET code = COALESCE(
  NULLIF(TRIM(code), ''),
  'PD-' || UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 8))
)
WHERE code IS NULL OR TRIM(code) = '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'support_tickets'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS ticket_number VARCHAR(20);

    UPDATE support_tickets
    SET ticket_number = COALESCE(
      NULLIF(TRIM(ticket_number), ''),
      'TKT-' || UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 8))
    )
    WHERE ticket_number IS NULL OR TRIM(ticket_number) = '';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Indexes (only when parent columns exist)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rental_sessions'
      AND column_name = 'user_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rental_sessions'
      AND column_name = 'status'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_one_open_per_user
      ON rental_sessions (user_id)
      WHERE status IN ('pending', 'active');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rental_sessions'
      AND column_name = 'payment_intent_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sessions_payment_intent
      ON rental_sessions (payment_intent_id)
      WHERE payment_intent_id IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rewards'
      AND column_name = 'code'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_rewards_code
      ON rewards (code);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'support_tickets'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'support_tickets'
        AND column_name = 'ticket_number'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_number
        ON support_tickets (ticket_number);
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Stripe webhook deduplication
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed
  ON stripe_webhook_events (processed_at DESC);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stripe_webhook_events_service ON stripe_webhook_events;
CREATE POLICY stripe_webhook_events_service ON stripe_webhook_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
