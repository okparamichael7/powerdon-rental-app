-- Sync rental_sessions to the schema expected by admin/PWA repositories.
-- Safe to re-run on partial databases (e.g. table created without 001 columns).
-- Run in Supabase SQL Editor after 004 (if applied).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- reward_status enum (from 001)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reward_status') THEN
    CREATE TYPE reward_status AS ENUM (
      'pending', 'qualified', 'issued', 'redeemed', 'expired', 'cancelled'
    );
  END IF;
END $$;

ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS pickup_station_id UUID;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS pickup_slot_number INTEGER;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS return_station_id UUID;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS return_slot_number INTEGER;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS daily_cap DECIMAL(10,2);
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS amount_charged DECIMAL(10,2) DEFAULT 0;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS amount_refunded DECIMAL(10,2) DEFAULT 0;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS payment_authorization_id VARCHAR(255);
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS reward_threshold_minutes INTEGER;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS reward_qualified BOOLEAN DEFAULT false;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS reward_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rental_sessions' AND column_name = 'reward_status'
  ) THEN
    ALTER TABLE rental_sessions ADD COLUMN reward_status reward_status DEFAULT 'pending';
  END IF;
END $$;

-- Foreign keys (skip if stations/rewards missing or already linked)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stations')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE constraint_name = 'rental_sessions_pickup_station_id_fkey'
     ) THEN
    ALTER TABLE rental_sessions
      ADD CONSTRAINT rental_sessions_pickup_station_id_fkey
      FOREIGN KEY (pickup_station_id) REFERENCES stations(id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pickup_station_id FK: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stations')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE constraint_name = 'rental_sessions_return_station_id_fkey'
     ) THEN
    ALTER TABLE rental_sessions
      ADD CONSTRAINT rental_sessions_return_station_id_fkey
      FOREIGN KEY (return_station_id) REFERENCES stations(id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'return_station_id FK: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rewards')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE constraint_name = 'rental_sessions_reward_id_fkey'
     ) THEN
    ALTER TABLE rental_sessions
      ADD CONSTRAINT rental_sessions_reward_id_fkey
      FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'reward_id FK: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_sessions_pickup_station ON rental_sessions(pickup_station_id);
CREATE INDEX IF NOT EXISTS idx_sessions_return_station ON rental_sessions(return_station_id);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
