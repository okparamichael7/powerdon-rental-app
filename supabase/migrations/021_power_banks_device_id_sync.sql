-- Legacy v0 partial DBs: power_banks.device_id NOT NULL (WsCharge terminal hex).
-- Inventory upserts use external_id; keep device_id in sync for inserts and reads.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'power_banks' AND column_name = 'device_id'
  ) THEN
    UPDATE power_banks
    SET device_id = external_id
    WHERE device_id IS NULL AND external_id IS NOT NULL;
  END IF;
END $$;
