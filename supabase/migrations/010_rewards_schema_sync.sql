-- Sync rewards table to schema expected by repositories (001 / admin APIs).
-- Safe on partial DBs that use reward_value instead of value.

ALTER TABLE rewards ADD COLUMN IF NOT EXISTS value DECIMAL(10,2);
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMPTZ;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS redemption_location VARCHAR(255);
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS redeemed_by_staff_id UUID;

UPDATE rewards
SET value = COALESCE(value, reward_value, 0)
WHERE value IS NULL;

UPDATE rewards
SET issued_at = COALESCE(issued_at, created_at, NOW())
WHERE issued_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_rewards_issued ON rewards(issued_at DESC);

NOTIFY pgrst, 'reload schema';
