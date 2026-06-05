-- One-shot checkout readiness for partial rental_sessions tables.
-- Safe to re-run. Run in Supabase SQL Editor if checkout fails with missing columns.

-- Core pickup + pricing columns (from 009)
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS pickup_station_id UUID;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS pickup_slot_number INTEGER;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS return_station_id UUID;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS return_slot_number INTEGER;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS daily_cap DECIMAL(10,2);
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS amount_charged DECIMAL(10,2) DEFAULT 0;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS amount_refunded DECIMAL(10,2) DEFAULT 0;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS payment_authorization_id VARCHAR(255);
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255);
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS reward_threshold_minutes INTEGER;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS reward_qualified BOOLEAN DEFAULT false;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS reward_id UUID;

-- Unlock + metadata (from 014)
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS unlock_token VARCHAR(255);
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS unlock_token_expires_at TIMESTAMPTZ;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- reward_status enum column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reward_status') THEN
    CREATE TYPE reward_status AS ENUM (
      'pending', 'qualified', 'issued', 'redeemed', 'expired', 'cancelled'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rental_sessions' AND column_name = 'reward_status'
  ) THEN
    ALTER TABLE rental_sessions ADD COLUMN reward_status reward_status DEFAULT 'pending';
  END IF;
END $$;

-- Session code auto-generation (from 001) when trigger was never applied
CREATE OR REPLACE FUNCTION generate_session_code()
RETURNS VARCHAR(20) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result VARCHAR(20) := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_session_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.session_code IS NULL OR NEW.session_code = '' THEN
    NEW.session_code := generate_session_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_session_code ON rental_sessions;
CREATE TRIGGER tr_session_code
  BEFORE INSERT ON rental_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_session_code();

NOTIFY pgrst, 'reload schema';
