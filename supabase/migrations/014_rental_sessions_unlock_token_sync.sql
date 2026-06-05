-- Checkout/unlock flow expects unlock_token on rental_sessions (001); missing on partial DBs.

ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS unlock_token VARCHAR(255);
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS unlock_token_expires_at TIMESTAMPTZ;
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
