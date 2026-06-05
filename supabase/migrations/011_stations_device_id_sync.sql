-- Legacy v0 partial DBs: stations.device_id NOT NULL (cabinet ProductSn / QR SN).
-- WsCharge login uses external_id; keep device_id in sync for inserts and reads.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stations' AND column_name = 'device_id'
  ) THEN
    UPDATE stations
    SET device_id = external_id
    WHERE device_id IS NULL AND external_id IS NOT NULL;
  END IF;
END $$;
