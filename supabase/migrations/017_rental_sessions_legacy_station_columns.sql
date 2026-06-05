-- Legacy rental_sessions schemas used start_station_id / start_slot_number (NOT NULL)
-- before pickup_station_id / pickup_slot_number (009). Sync both directions.

ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS start_station_id UUID;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS start_slot_number INTEGER;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS pickup_station_id UUID;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS pickup_slot_number INTEGER;

UPDATE rental_sessions
SET start_station_id = pickup_station_id
WHERE start_station_id IS NULL AND pickup_station_id IS NOT NULL;

UPDATE rental_sessions
SET pickup_station_id = start_station_id
WHERE pickup_station_id IS NULL AND start_station_id IS NOT NULL;

UPDATE rental_sessions
SET start_slot_number = pickup_slot_number
WHERE start_slot_number IS NULL AND pickup_slot_number IS NOT NULL;

UPDATE rental_sessions
SET pickup_slot_number = start_slot_number
WHERE pickup_slot_number IS NULL AND start_slot_number IS NOT NULL;

CREATE OR REPLACE FUNCTION sync_rental_session_station_ids()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pickup_station_id IS NOT NULL AND NEW.start_station_id IS NULL THEN
    NEW.start_station_id := NEW.pickup_station_id;
  ELSIF NEW.start_station_id IS NOT NULL AND NEW.pickup_station_id IS NULL THEN
    NEW.pickup_station_id := NEW.start_station_id;
  END IF;

  IF NEW.pickup_slot_number IS NOT NULL AND NEW.start_slot_number IS NULL THEN
    NEW.start_slot_number := NEW.pickup_slot_number;
  ELSIF NEW.start_slot_number IS NOT NULL AND NEW.pickup_slot_number IS NULL THEN
    NEW.pickup_slot_number := NEW.start_slot_number;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_rental_session_station_sync ON rental_sessions;
CREATE TRIGGER tr_rental_session_station_sync
  BEFORE INSERT OR UPDATE ON rental_sessions
  FOR EACH ROW
  EXECUTE FUNCTION sync_rental_session_station_ids();

NOTIFY pgrst, 'reload schema';
