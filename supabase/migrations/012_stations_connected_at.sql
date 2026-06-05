-- Track when a cabinet last established a TCP session (login).
-- Used by admin UI when Vercel has no in-memory connection state.

ALTER TABLE stations ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;

UPDATE stations
SET connected_at = COALESCE(last_heartbeat, created_at)
WHERE connected_at IS NULL;
