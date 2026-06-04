-- WsCharge: hardware_events log + idempotent ingestion
--
-- Safe to run on a fresh Supabase project (no FKs to hardware_commands).
-- For the full rental schema (stations, sessions, RLS), also run:
--   001_initial_schema.sql
--   002_rls_policies.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS hardware_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID,
  station_external_id VARCHAR(100),
  event_type VARCHAR(50) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  raw_data BYTEA,
  parsed_data JSONB,
  command_id UUID,
  response_code INTEGER,
  processing_time_ms INTEGER,
  error_message TEXT,
  idempotency_key VARCHAR(64),
  correlation_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrades: table from 001 without WsCharge columns
ALTER TABLE hardware_events
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64),
  ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(64);

-- Optional FK to stations when that table exists (001 applied)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stations'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'hardware_events_station_id_fkey'
      AND table_name = 'hardware_events'
  ) THEN
    ALTER TABLE hardware_events
      ADD CONSTRAINT hardware_events_station_id_fkey
      FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Optional FK to hardware_commands when that table exists (001 applied)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'hardware_commands'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'hardware_events_command_id_fkey'
      AND table_name = 'hardware_events'
  ) THEN
    ALTER TABLE hardware_events
      ADD CONSTRAINT hardware_events_command_id_fkey
      FOREIGN KEY (command_id) REFERENCES hardware_commands(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hardware_events_station ON hardware_events(station_id);
CREATE INDEX IF NOT EXISTS idx_hardware_events_time ON hardware_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hardware_events_type ON hardware_events(event_type);
CREATE INDEX IF NOT EXISTS idx_hardware_events_external ON hardware_events(station_external_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hardware_events_idempotency
  ON hardware_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hardware_events_correlation
  ON hardware_events (correlation_id)
  WHERE correlation_id IS NOT NULL;

COMMENT ON TABLE hardware_events IS 'WsCharge protocol event log (v5.8P)';
COMMENT ON COLUMN hardware_events.idempotency_key IS 'SHA-256 dedup key for inbound frames';
COMMENT ON COLUMN hardware_events.correlation_id IS 'TCP proxy / request correlation ID';
