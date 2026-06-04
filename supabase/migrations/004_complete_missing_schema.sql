-- Completes a partial database (e.g. campaigns, stations, users, rental_sessions, rewards exist).
-- Do NOT re-run 001_initial_schema.sql — it will fail on tables you already have.
--
-- Run order:
--   1. Run STEP 1 (Enums section) below — click Run, wait for success
--   2. Run STEP 2 (tables section) — or run the whole file if your SQL editor auto-commits each statement
--   3. 003_wscharge_hardware_idempotency.sql (safe to re-run)
--   4. 002_rls_policies.sql (if not applied yet)
--
-- If you see invalid input value for enum slot_status: "empty", your DB had slot_status
-- without that label. STEP 1 adds missing labels before tables are created.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== STEP 1: ENUMS (run this block first if enum errors occur) ==========
DO $$
DECLARE
  type_name TEXT := 'slot_status';
  vals TEXT[] := ARRAY['empty', 'occupied', 'reserved', 'error', 'disabled'];
  v TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = type_name) THEN
    EXECUTE format(
      'CREATE TYPE %I AS ENUM (%s)',
      type_name,
      (SELECT string_agg(quote_literal(x), ', ') FROM unnest(vals) AS x)
    );
  ELSE
    FOREACH v IN ARRAY vals LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = type_name AND e.enumlabel = v
      ) THEN
        EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_name, v);
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE
  type_name TEXT := 'power_bank_status';
  vals TEXT[] := ARRAY['available', 'rented', 'charging', 'maintenance', 'lost', 'damaged'];
  v TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = type_name) THEN
    EXECUTE format(
      'CREATE TYPE %I AS ENUM (%s)',
      type_name,
      (SELECT string_agg(quote_literal(x), ', ') FROM unnest(vals) AS x)
    );
  ELSE
    FOREACH v IN ARRAY vals LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = type_name AND e.enumlabel = v
      ) THEN
        EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_name, v);
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE
  type_name TEXT := 'command_type';
  vals TEXT[] := ARRAY['login', 'heartbeat', 'inventory', 'borrow', 'return', 'force_eject', 'reboot', 'settings', 'update'];
  v TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = type_name) THEN
    EXECUTE format(
      'CREATE TYPE %I AS ENUM (%s)',
      type_name,
      (SELECT string_agg(quote_literal(x), ', ') FROM unnest(vals) AS x)
    );
  ELSE
    FOREACH v IN ARRAY vals LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = type_name AND e.enumlabel = v
      ) THEN
        EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_name, v);
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE
  type_name TEXT := 'command_status';
  vals TEXT[] := ARRAY['pending', 'sent', 'acknowledged', 'completed', 'failed', 'timeout'];
  v TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = type_name) THEN
    EXECUTE format(
      'CREATE TYPE %I AS ENUM (%s)',
      type_name,
      (SELECT string_agg(quote_literal(x), ', ') FROM unnest(vals) AS x)
    );
  ELSE
    FOREACH v IN ARRAY vals LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = type_name AND e.enumlabel = v
      ) THEN
        EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_name, v);
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE
  type_name TEXT := 'event_type';
  vals TEXT[] := ARRAY['scan', 'auth', 'payment', 'unlock', 'pickup', 'return', 'reward', 'refund', 'error', 'support', 'admin'];
  v TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = type_name) THEN
    EXECUTE format(
      'CREATE TYPE %I AS ENUM (%s)',
      type_name,
      (SELECT string_agg(quote_literal(x), ', ') FROM unnest(vals) AS x)
    );
  ELSE
    FOREACH v IN ARRAY vals LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = type_name AND e.enumlabel = v
      ) THEN
        EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_name, v);
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE
  type_name TEXT := 'support_category';
  vals TEXT[] := ARRAY['rental_issue', 'payment_issue', 'return_issue', 'reward_issue', 'station_issue', 'account_issue', 'other'];
  v TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = type_name) THEN
    EXECUTE format(
      'CREATE TYPE %I AS ENUM (%s)',
      type_name,
      (SELECT string_agg(quote_literal(x), ', ') FROM unnest(vals) AS x)
    );
  ELSE
    FOREACH v IN ARRAY vals LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = type_name AND e.enumlabel = v
      ) THEN
        EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_name, v);
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE
  type_name TEXT := 'support_priority';
  vals TEXT[] := ARRAY['low', 'medium', 'high', 'urgent'];
  v TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = type_name) THEN
    EXECUTE format(
      'CREATE TYPE %I AS ENUM (%s)',
      type_name,
      (SELECT string_agg(quote_literal(x), ', ') FROM unnest(vals) AS x)
    );
  ELSE
    FOREACH v IN ARRAY vals LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = type_name AND e.enumlabel = v
      ) THEN
        EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_name, v);
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE
  type_name TEXT := 'support_status';
  vals TEXT[] := ARRAY['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'];
  v TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = type_name) THEN
    EXECUTE format(
      'CREATE TYPE %I AS ENUM (%s)',
      type_name,
      (SELECT string_agg(quote_literal(x), ', ') FROM unnest(vals) AS x)
    );
  ELSE
    FOREACH v IN ARRAY vals LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = type_name AND e.enumlabel = v
      ) THEN
        EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_name, v);
      END IF;
    END LOOP;
  END IF;
END $$;

-- ========== STEP 2: TABLES (run after STEP 1 succeeds) ==========

CREATE TABLE IF NOT EXISTS station_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL,
  status slot_status NOT NULL DEFAULT 'empty',
  power_bank_id UUID,
  battery_level INTEGER,
  is_charging BOOLEAN DEFAULT false,
  last_status_change TIMESTAMPTZ DEFAULT NOW(),
  error_code VARCHAR(50),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_station_slot UNIQUE (station_id, slot_number),
  CONSTRAINT valid_slot_number CHECK (slot_number > 0),
  CONSTRAINT valid_battery CHECK (battery_level IS NULL OR (battery_level >= 0 AND battery_level <= 100))
);

CREATE TABLE IF NOT EXISTS power_banks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id VARCHAR(100) UNIQUE NOT NULL,
  model VARCHAR(100),
  capacity_mah INTEGER DEFAULT 10000,
  status power_bank_status NOT NULL DEFAULT 'available',
  current_station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  current_slot_number INTEGER,
  battery_level INTEGER,
  charge_cycles INTEGER DEFAULT 0,
  total_rental_minutes INTEGER DEFAULT 0,
  total_rentals INTEGER DEFAULT 0,
  last_maintenance TIMESTAMPTZ,
  manufactured_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_capacity CHECK (capacity_mah > 0)
);

-- Upgrade tables that already exist with an older/partial schema
ALTER TABLE station_slots ADD COLUMN IF NOT EXISTS power_bank_id UUID;
ALTER TABLE station_slots ADD COLUMN IF NOT EXISTS battery_level INTEGER;
ALTER TABLE station_slots ADD COLUMN IF NOT EXISTS is_charging BOOLEAN DEFAULT false;
ALTER TABLE station_slots ADD COLUMN IF NOT EXISTS last_status_change TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE station_slots ADD COLUMN IF NOT EXISTS error_code VARCHAR(50);
ALTER TABLE station_slots ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE station_slots ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE station_slots ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE station_slots ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE power_banks ADD COLUMN IF NOT EXISTS external_id VARCHAR(100);
ALTER TABLE power_banks ADD COLUMN IF NOT EXISTS model VARCHAR(100);
ALTER TABLE power_banks ADD COLUMN IF NOT EXISTS capacity_mah INTEGER DEFAULT 10000;
ALTER TABLE power_banks ADD COLUMN IF NOT EXISTS current_station_id UUID REFERENCES stations(id) ON DELETE SET NULL;
ALTER TABLE power_banks ADD COLUMN IF NOT EXISTS current_slot_number INTEGER;
ALTER TABLE power_banks ADD COLUMN IF NOT EXISTS battery_level INTEGER;
ALTER TABLE power_banks ADD COLUMN IF NOT EXISTS charge_cycles INTEGER DEFAULT 0;
ALTER TABLE power_banks ADD COLUMN IF NOT EXISTS total_rental_minutes INTEGER DEFAULT 0;
ALTER TABLE power_banks ADD COLUMN IF NOT EXISTS total_rentals INTEGER DEFAULT 0;
ALTER TABLE power_banks ADD COLUMN IF NOT EXISTS last_maintenance TIMESTAMPTZ;
ALTER TABLE power_banks ADD COLUMN IF NOT EXISTS manufactured_at TIMESTAMPTZ;
ALTER TABLE power_banks ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE power_banks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE power_banks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'power_banks' AND column_name = 'status'
  ) THEN
    NULL;
  ELSE
    ALTER TABLE power_banks
      ADD COLUMN status power_bank_status NOT NULL DEFAULT 'available';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'power_banks.status column: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_slot_power_bank' AND table_name = 'station_slots'
  ) THEN
    ALTER TABLE station_slots
      ADD CONSTRAINT fk_slot_power_bank
      FOREIGN KEY (power_bank_id) REFERENCES power_banks(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS session_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES rental_sessions(id) ON DELETE CASCADE,
  event_type event_type NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  actor_type VARCHAR(50) DEFAULT 'system',
  actor_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hardware_commands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  command_type command_type NOT NULL,
  slot_number INTEGER,
  payload JSONB DEFAULT '{}',
  status command_status NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes'),
  response_code INTEGER,
  response_data JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  session_id UUID REFERENCES rental_sessions(id) ON DELETE SET NULL,
  triggered_by UUID,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS hardware_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  station_external_id VARCHAR(100),
  event_type VARCHAR(50) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  raw_data BYTEA,
  parsed_data JSONB,
  command_id UUID REFERENCES hardware_commands(id) ON DELETE SET NULL,
  response_code INTEGER,
  processing_time_ms INTEGER,
  error_message TEXT,
  idempotency_key VARCHAR(64),
  correlation_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE hardware_events
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64),
  ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(64);

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number VARCHAR(20) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  session_id UUID REFERENCES rental_sessions(id),
  category support_category NOT NULL,
  priority support_priority NOT NULL DEFAULT 'medium',
  status support_status NOT NULL DEFAULT 'open',
  subject VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  assigned_to UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  total_sessions INTEGER DEFAULT 0,
  completed_sessions INTEGER DEFAULT 0,
  failed_sessions INTEGER DEFAULT 0,
  cancelled_sessions INTEGER DEFAULT 0,
  total_duration_minutes INTEGER DEFAULT 0,
  avg_duration_minutes DECIMAL(10,2) DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  total_deposits DECIMAL(10,2) DEFAULT 0,
  total_refunds DECIMAL(10,2) DEFAULT 0,
  rewards_qualified INTEGER DEFAULT 0,
  rewards_issued INTEGER DEFAULT 0,
  rewards_redeemed INTEGER DEFAULT 0,
  rewards_value_issued DECIMAL(10,2) DEFAULT 0,
  rewards_value_redeemed DECIMAL(10,2) DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  returning_users INTEGER DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_daily_aggregate UNIQUE (date, campaign_id, station_id)
);

CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

INSERT INTO system_settings (key, value, description) VALUES
  ('tcp_server', '{"enabled": true, "port": 8088, "host": "0.0.0.0", "timeout_ms": 30000}', 'TCP server configuration for station connections'),
  ('heartbeat', '{"interval_seconds": 60, "timeout_seconds": 180, "max_missed": 3}', 'Station heartbeat settings'),
  ('rental', '{"max_duration_hours": 24, "grace_period_minutes": 15, "auto_expire_hours": 48}', 'Rental session settings'),
  ('rewards', '{"default_expiry_days": 30, "code_length": 8, "code_prefix": "PD"}', 'Reward settings'),
  ('notifications', '{"email_enabled": true, "sms_enabled": false}', 'Notification settings')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Indexes (only on columns that exist — safe for partial tables)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'station_slots' AND column_name = 'station_id') THEN
    CREATE INDEX IF NOT EXISTS idx_slots_station ON station_slots(station_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'station_slots' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_slots_status ON station_slots(status);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'power_banks' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_power_banks_status ON power_banks(status);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'power_banks' AND column_name = 'current_station_id') THEN
    CREATE INDEX IF NOT EXISTS idx_power_banks_station ON power_banks(current_station_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'power_banks' AND column_name = 'external_id') THEN
    CREATE INDEX IF NOT EXISTS idx_power_banks_external ON power_banks(external_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'session_events') THEN
    CREATE INDEX IF NOT EXISTS idx_session_events_session ON session_events(session_id);
    CREATE INDEX IF NOT EXISTS idx_session_events_type ON session_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_session_events_time ON session_events(created_at DESC);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hardware_commands') THEN
    CREATE INDEX IF NOT EXISTS idx_commands_station ON hardware_commands(station_id);
    CREATE INDEX IF NOT EXISTS idx_commands_status ON hardware_commands(status);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'hardware_events' AND column_name = 'station_id') THEN
    CREATE INDEX IF NOT EXISTS idx_hardware_events_station ON hardware_events(station_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'hardware_events' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_hardware_events_time ON hardware_events(created_at DESC);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'hardware_events' AND column_name = 'event_type') THEN
    CREATE INDEX IF NOT EXISTS idx_hardware_events_type ON hardware_events(event_type);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'hardware_events' AND column_name = 'idempotency_key') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_hardware_events_idempotency
      ON hardware_events (idempotency_key) WHERE idempotency_key IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'hardware_events' AND column_name = 'correlation_id') THEN
    CREATE INDEX IF NOT EXISTS idx_hardware_events_correlation
      ON hardware_events (correlation_id) WHERE correlation_id IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'support_tickets') THEN
    CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'analytics_daily') THEN
    CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_daily(date DESC);
  END IF;
END $$;

-- Optional FKs on rental_sessions (if columns exist but FKs were never added)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rental_sessions' AND column_name = 'power_bank_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'rental_sessions_power_bank_id_fkey'
  ) THEN
    ALTER TABLE rental_sessions
      ADD CONSTRAINT rental_sessions_power_bank_id_fkey
      FOREIGN KEY (power_bank_id) REFERENCES power_banks(id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipped rental_sessions -> power_banks FK: %', SQLERRM;
END $$;
