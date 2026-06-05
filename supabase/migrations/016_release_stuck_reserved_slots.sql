-- Release slots stuck in reserved from abandoned checkouts (older than 30 minutes).
-- Safe to run manually or via cron.

UPDATE station_slots
SET
  status = 'occupied',
  last_status_change = NOW()
WHERE status = 'reserved'
  AND last_status_change < NOW() - INTERVAL '30 minutes';

NOTIFY pgrst, 'reload schema';
