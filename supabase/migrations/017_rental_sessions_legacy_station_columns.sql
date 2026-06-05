-- Retire legacy start_station_id / start_slot_number in favor of pickup_* (001/009).
-- Run once in Supabase SQL Editor. Safe to re-run.

ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS pickup_station_id UUID;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS pickup_slot_number INTEGER;

UPDATE rental_sessions
SET pickup_station_id = start_station_id
WHERE pickup_station_id IS NULL
  AND start_station_id IS NOT NULL;

UPDATE rental_sessions
SET pickup_slot_number = start_slot_number
WHERE pickup_slot_number IS NULL
  AND start_slot_number IS NOT NULL;

DROP TRIGGER IF EXISTS tr_rental_session_station_sync ON rental_sessions;
DROP FUNCTION IF EXISTS sync_rental_session_station_ids();

ALTER TABLE rental_sessions DROP COLUMN IF EXISTS start_station_id;
ALTER TABLE rental_sessions DROP COLUMN IF EXISTS start_slot_number;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM rental_sessions WHERE pickup_station_id IS NULL) THEN
    ALTER TABLE rental_sessions ALTER COLUMN pickup_station_id SET NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pickup_station_id NOT NULL skipped: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
