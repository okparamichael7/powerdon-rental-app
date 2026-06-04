-- Row Level Security Policies
-- Enterprise-grade access control
--
-- Prerequisite: partial DBs may lack columns referenced below. Run this block first.

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
UPDATE campaigns SET is_active = true WHERE is_active IS NULL;

ALTER TABLE stations ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;
UPDATE stations SET is_enabled = true WHERE is_enabled IS NULL;

ALTER TABLE stations ADD COLUMN IF NOT EXISTS external_id VARCHAR(100);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stations' AND column_name = 'status'
  ) THEN
    ALTER TABLE stations ADD COLUMN status station_status NOT NULL DEFAULT 'offline';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'stations.status column: %', SQLERRM;
END $$;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS total_slots INTEGER DEFAULT 12;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS connection_ip VARCHAR(45);
ALTER TABLE stations ADD COLUMN IF NOT EXISTS campaign_id UUID;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
ALTER TABLE stations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE stations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE stations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- station_status enum if missing (partial 001)
DO $$
DECLARE
  type_name TEXT := 'station_status';
  vals TEXT[] := ARRAY['online', 'offline', 'maintenance', 'low_battery', 'error'];
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

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE power_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE hardware_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE hardware_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      (auth.jwt() -> 'user_metadata' ->> 'is_admin')::BOOLEAN,
      FALSE
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is staff
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      (auth.jwt() -> 'user_metadata' ->> 'is_staff')::BOOLEAN,
      FALSE
    ) OR is_admin()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current user's rental user ID
CREATE OR REPLACE FUNCTION get_rental_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CAMPAIGNS POLICIES
-- ============================================================================

-- Anyone can read active campaigns
DROP POLICY IF EXISTS "campaigns_select_active" ON campaigns;
CREATE POLICY "campaigns_select_active" ON campaigns
  FOR SELECT USING (is_active = true);

-- Staff/Admin can read all campaigns
DROP POLICY IF EXISTS "campaigns_select_staff" ON campaigns;
CREATE POLICY "campaigns_select_staff" ON campaigns
  FOR SELECT USING (is_staff());

-- Admin can insert/update/delete
DROP POLICY IF EXISTS "campaigns_insert_admin" ON campaigns;
CREATE POLICY "campaigns_insert_admin" ON campaigns
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "campaigns_update_admin" ON campaigns;
CREATE POLICY "campaigns_update_admin" ON campaigns
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "campaigns_delete_admin" ON campaigns;
CREATE POLICY "campaigns_delete_admin" ON campaigns
  FOR DELETE USING (is_admin());

-- ============================================================================
-- STATIONS POLICIES
-- ============================================================================

-- Anyone can read enabled stations
DROP POLICY IF EXISTS "stations_select_public" ON stations;
CREATE POLICY "stations_select_public" ON stations
  FOR SELECT USING (is_enabled = true);

-- Staff can read all stations
DROP POLICY IF EXISTS "stations_select_staff" ON stations;
CREATE POLICY "stations_select_staff" ON stations
  FOR SELECT USING (is_staff());

-- Admin can manage stations
DROP POLICY IF EXISTS "stations_insert_admin" ON stations;
CREATE POLICY "stations_insert_admin" ON stations
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "stations_update_admin" ON stations;
CREATE POLICY "stations_update_admin" ON stations
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "stations_delete_admin" ON stations;
CREATE POLICY "stations_delete_admin" ON stations
  FOR DELETE USING (is_admin());

-- Service role (for hardware communication) can update
DROP POLICY IF EXISTS "stations_update_service" ON stations;
CREATE POLICY "stations_update_service" ON stations
  FOR UPDATE USING (auth.role() = 'service_role');

-- ============================================================================
-- STATION SLOTS POLICIES
-- ============================================================================

-- Anyone can read slot status (for availability display)
DROP POLICY IF EXISTS "slots_select_public" ON station_slots;
CREATE POLICY "slots_select_public" ON station_slots
  FOR SELECT USING (true);

-- Admin/Service can manage slots
DROP POLICY IF EXISTS "slots_manage_admin" ON station_slots;
CREATE POLICY "slots_manage_admin" ON station_slots
  FOR ALL USING (is_admin() OR auth.role() = 'service_role');

-- ============================================================================
-- POWER BANKS POLICIES
-- ============================================================================

-- Staff can read power banks
DROP POLICY IF EXISTS "power_banks_select_staff" ON power_banks;
CREATE POLICY "power_banks_select_staff" ON power_banks
  FOR SELECT USING (is_staff());

-- Admin/Service can manage power banks
DROP POLICY IF EXISTS "power_banks_manage_admin" ON power_banks;
CREATE POLICY "power_banks_manage_admin" ON power_banks
  FOR ALL USING (is_admin() OR auth.role() = 'service_role');

-- ============================================================================
-- USERS POLICIES (Rental customers)
-- ============================================================================

-- Users can read their own profile
DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth_user_id = auth.uid());

-- Staff can read all users
DROP POLICY IF EXISTS "users_select_staff" ON users;
CREATE POLICY "users_select_staff" ON users
  FOR SELECT USING (is_staff());

-- Service role can create users (for guest rentals)
DROP POLICY IF EXISTS "users_insert_service" ON users;
CREATE POLICY "users_insert_service" ON users
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Users can update their own profile
DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth_user_id = auth.uid());

-- Admin can manage users
DROP POLICY IF EXISTS "users_manage_admin" ON users;
CREATE POLICY "users_manage_admin" ON users
  FOR ALL USING (is_admin());

-- ============================================================================
-- RENTAL SESSIONS POLICIES
-- ============================================================================

-- Users can read their own sessions
DROP POLICY IF EXISTS "sessions_select_own" ON rental_sessions;
CREATE POLICY "sessions_select_own" ON rental_sessions
  FOR SELECT USING (user_id = get_rental_user_id());

-- Staff can read all sessions
DROP POLICY IF EXISTS "sessions_select_staff" ON rental_sessions;
CREATE POLICY "sessions_select_staff" ON rental_sessions
  FOR SELECT USING (is_staff());

-- Service role can create sessions
DROP POLICY IF EXISTS "sessions_insert_service" ON rental_sessions;
CREATE POLICY "sessions_insert_service" ON rental_sessions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Service role and admin can update sessions
DROP POLICY IF EXISTS "sessions_update_service" ON rental_sessions;
CREATE POLICY "sessions_update_service" ON rental_sessions
  FOR UPDATE USING (auth.role() = 'service_role' OR is_admin());

-- Admin can delete sessions (for cleanup)
DROP POLICY IF EXISTS "sessions_delete_admin" ON rental_sessions;
CREATE POLICY "sessions_delete_admin" ON rental_sessions
  FOR DELETE USING (is_admin());

-- ============================================================================
-- SESSION EVENTS POLICIES
-- ============================================================================

-- Users can read events for their own sessions
DROP POLICY IF EXISTS "session_events_select_own" ON session_events;
CREATE POLICY "session_events_select_own" ON session_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rental_sessions 
      WHERE rental_sessions.id = session_events.session_id 
      AND rental_sessions.user_id = get_rental_user_id()
    )
  );

-- Staff can read all events
DROP POLICY IF EXISTS "session_events_select_staff" ON session_events;
CREATE POLICY "session_events_select_staff" ON session_events
  FOR SELECT USING (is_staff());

-- Service role can insert events
DROP POLICY IF EXISTS "session_events_insert_service" ON session_events;
CREATE POLICY "session_events_insert_service" ON session_events
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR is_staff());

-- ============================================================================
-- REWARDS POLICIES
-- ============================================================================

-- Users can read their own rewards
DROP POLICY IF EXISTS "rewards_select_own" ON rewards;
CREATE POLICY "rewards_select_own" ON rewards
  FOR SELECT USING (user_id = get_rental_user_id());

-- Staff can read all rewards
DROP POLICY IF EXISTS "rewards_select_staff" ON rewards;
CREATE POLICY "rewards_select_staff" ON rewards
  FOR SELECT USING (is_staff());

-- Service role can create rewards
DROP POLICY IF EXISTS "rewards_insert_service" ON rewards;
CREATE POLICY "rewards_insert_service" ON rewards
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Staff can update rewards (for redemption)
DROP POLICY IF EXISTS "rewards_update_staff" ON rewards;
CREATE POLICY "rewards_update_staff" ON rewards
  FOR UPDATE USING (is_staff() OR auth.role() = 'service_role');

-- Admin can delete rewards
DROP POLICY IF EXISTS "rewards_delete_admin" ON rewards;
CREATE POLICY "rewards_delete_admin" ON rewards
  FOR DELETE USING (is_admin());

-- ============================================================================
-- HARDWARE COMMANDS POLICIES
-- ============================================================================

-- Staff can read commands
DROP POLICY IF EXISTS "commands_select_staff" ON hardware_commands;
CREATE POLICY "commands_select_staff" ON hardware_commands
  FOR SELECT USING (is_staff());

-- Admin/Service can manage commands
DROP POLICY IF EXISTS "commands_manage" ON hardware_commands;
CREATE POLICY "commands_manage" ON hardware_commands
  FOR ALL USING (is_admin() OR auth.role() = 'service_role');

-- ============================================================================
-- HARDWARE EVENTS POLICIES
-- ============================================================================

-- Staff can read hardware events
DROP POLICY IF EXISTS "hardware_events_select_staff" ON hardware_events;
CREATE POLICY "hardware_events_select_staff" ON hardware_events
  FOR SELECT USING (is_staff());

-- Service role can insert hardware events
DROP POLICY IF EXISTS "hardware_events_insert_service" ON hardware_events;
CREATE POLICY "hardware_events_insert_service" ON hardware_events
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Admin can manage hardware events
DROP POLICY IF EXISTS "hardware_events_manage_admin" ON hardware_events;
CREATE POLICY "hardware_events_manage_admin" ON hardware_events
  FOR ALL USING (is_admin());

-- ============================================================================
-- SUPPORT TICKETS POLICIES
-- ============================================================================

-- Users can read their own tickets
DROP POLICY IF EXISTS "tickets_select_own" ON support_tickets;
CREATE POLICY "tickets_select_own" ON support_tickets
  FOR SELECT USING (user_id = get_rental_user_id());

-- Staff can read all tickets
DROP POLICY IF EXISTS "tickets_select_staff" ON support_tickets;
CREATE POLICY "tickets_select_staff" ON support_tickets
  FOR SELECT USING (is_staff());

-- Anyone can create tickets (for guest support)
DROP POLICY IF EXISTS "tickets_insert_public" ON support_tickets;
CREATE POLICY "tickets_insert_public" ON support_tickets
  FOR INSERT WITH CHECK (true);

-- Staff can update tickets
DROP POLICY IF EXISTS "tickets_update_staff" ON support_tickets;
CREATE POLICY "tickets_update_staff" ON support_tickets
  FOR UPDATE USING (is_staff());

-- Admin can delete tickets
DROP POLICY IF EXISTS "tickets_delete_admin" ON support_tickets;
CREATE POLICY "tickets_delete_admin" ON support_tickets
  FOR DELETE USING (is_admin());

-- ============================================================================
-- ANALYTICS POLICIES
-- ============================================================================

-- Staff can read analytics
DROP POLICY IF EXISTS "analytics_select_staff" ON analytics_daily;
CREATE POLICY "analytics_select_staff" ON analytics_daily
  FOR SELECT USING (is_staff());

-- Service role can manage analytics
DROP POLICY IF EXISTS "analytics_manage_service" ON analytics_daily;
CREATE POLICY "analytics_manage_service" ON analytics_daily
  FOR ALL USING (auth.role() = 'service_role' OR is_admin());

-- ============================================================================
-- SYSTEM SETTINGS POLICIES
-- ============================================================================

-- Staff can read settings
DROP POLICY IF EXISTS "settings_select_staff" ON system_settings;
CREATE POLICY "settings_select_staff" ON system_settings
  FOR SELECT USING (is_staff());

-- Admin can manage settings
DROP POLICY IF EXISTS "settings_manage_admin" ON system_settings;
CREATE POLICY "settings_manage_admin" ON system_settings
  FOR ALL USING (is_admin());
