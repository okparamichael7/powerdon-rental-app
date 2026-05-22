-- Row Level Security Policies
-- Enterprise-grade access control

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
CREATE POLICY "campaigns_select_active" ON campaigns
  FOR SELECT USING (is_active = true);

-- Staff/Admin can read all campaigns
CREATE POLICY "campaigns_select_staff" ON campaigns
  FOR SELECT USING (is_staff());

-- Admin can insert/update/delete
CREATE POLICY "campaigns_insert_admin" ON campaigns
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "campaigns_update_admin" ON campaigns
  FOR UPDATE USING (is_admin());

CREATE POLICY "campaigns_delete_admin" ON campaigns
  FOR DELETE USING (is_admin());

-- ============================================================================
-- STATIONS POLICIES
-- ============================================================================

-- Anyone can read enabled stations
CREATE POLICY "stations_select_public" ON stations
  FOR SELECT USING (is_enabled = true);

-- Staff can read all stations
CREATE POLICY "stations_select_staff" ON stations
  FOR SELECT USING (is_staff());

-- Admin can manage stations
CREATE POLICY "stations_insert_admin" ON stations
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "stations_update_admin" ON stations
  FOR UPDATE USING (is_admin());

CREATE POLICY "stations_delete_admin" ON stations
  FOR DELETE USING (is_admin());

-- Service role (for hardware communication) can update
CREATE POLICY "stations_update_service" ON stations
  FOR UPDATE USING (auth.role() = 'service_role');

-- ============================================================================
-- STATION SLOTS POLICIES
-- ============================================================================

-- Anyone can read slot status (for availability display)
CREATE POLICY "slots_select_public" ON station_slots
  FOR SELECT USING (true);

-- Admin/Service can manage slots
CREATE POLICY "slots_manage_admin" ON station_slots
  FOR ALL USING (is_admin() OR auth.role() = 'service_role');

-- ============================================================================
-- POWER BANKS POLICIES
-- ============================================================================

-- Staff can read power banks
CREATE POLICY "power_banks_select_staff" ON power_banks
  FOR SELECT USING (is_staff());

-- Admin/Service can manage power banks
CREATE POLICY "power_banks_manage_admin" ON power_banks
  FOR ALL USING (is_admin() OR auth.role() = 'service_role');

-- ============================================================================
-- USERS POLICIES (Rental customers)
-- ============================================================================

-- Users can read their own profile
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth_user_id = auth.uid());

-- Staff can read all users
CREATE POLICY "users_select_staff" ON users
  FOR SELECT USING (is_staff());

-- Service role can create users (for guest rentals)
CREATE POLICY "users_insert_service" ON users
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Users can update their own profile
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth_user_id = auth.uid());

-- Admin can manage users
CREATE POLICY "users_manage_admin" ON users
  FOR ALL USING (is_admin());

-- ============================================================================
-- RENTAL SESSIONS POLICIES
-- ============================================================================

-- Users can read their own sessions
CREATE POLICY "sessions_select_own" ON rental_sessions
  FOR SELECT USING (user_id = get_rental_user_id());

-- Staff can read all sessions
CREATE POLICY "sessions_select_staff" ON rental_sessions
  FOR SELECT USING (is_staff());

-- Service role can create sessions
CREATE POLICY "sessions_insert_service" ON rental_sessions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Service role and admin can update sessions
CREATE POLICY "sessions_update_service" ON rental_sessions
  FOR UPDATE USING (auth.role() = 'service_role' OR is_admin());

-- Admin can delete sessions (for cleanup)
CREATE POLICY "sessions_delete_admin" ON rental_sessions
  FOR DELETE USING (is_admin());

-- ============================================================================
-- SESSION EVENTS POLICIES
-- ============================================================================

-- Users can read events for their own sessions
CREATE POLICY "session_events_select_own" ON session_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rental_sessions 
      WHERE rental_sessions.id = session_events.session_id 
      AND rental_sessions.user_id = get_rental_user_id()
    )
  );

-- Staff can read all events
CREATE POLICY "session_events_select_staff" ON session_events
  FOR SELECT USING (is_staff());

-- Service role can insert events
CREATE POLICY "session_events_insert_service" ON session_events
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR is_staff());

-- ============================================================================
-- REWARDS POLICIES
-- ============================================================================

-- Users can read their own rewards
CREATE POLICY "rewards_select_own" ON rewards
  FOR SELECT USING (user_id = get_rental_user_id());

-- Staff can read all rewards
CREATE POLICY "rewards_select_staff" ON rewards
  FOR SELECT USING (is_staff());

-- Service role can create rewards
CREATE POLICY "rewards_insert_service" ON rewards
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Staff can update rewards (for redemption)
CREATE POLICY "rewards_update_staff" ON rewards
  FOR UPDATE USING (is_staff() OR auth.role() = 'service_role');

-- Admin can delete rewards
CREATE POLICY "rewards_delete_admin" ON rewards
  FOR DELETE USING (is_admin());

-- ============================================================================
-- HARDWARE COMMANDS POLICIES
-- ============================================================================

-- Staff can read commands
CREATE POLICY "commands_select_staff" ON hardware_commands
  FOR SELECT USING (is_staff());

-- Admin/Service can manage commands
CREATE POLICY "commands_manage" ON hardware_commands
  FOR ALL USING (is_admin() OR auth.role() = 'service_role');

-- ============================================================================
-- HARDWARE EVENTS POLICIES
-- ============================================================================

-- Staff can read hardware events
CREATE POLICY "hardware_events_select_staff" ON hardware_events
  FOR SELECT USING (is_staff());

-- Service role can insert hardware events
CREATE POLICY "hardware_events_insert_service" ON hardware_events
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Admin can manage hardware events
CREATE POLICY "hardware_events_manage_admin" ON hardware_events
  FOR ALL USING (is_admin());

-- ============================================================================
-- SUPPORT TICKETS POLICIES
-- ============================================================================

-- Users can read their own tickets
CREATE POLICY "tickets_select_own" ON support_tickets
  FOR SELECT USING (user_id = get_rental_user_id());

-- Staff can read all tickets
CREATE POLICY "tickets_select_staff" ON support_tickets
  FOR SELECT USING (is_staff());

-- Anyone can create tickets (for guest support)
CREATE POLICY "tickets_insert_public" ON support_tickets
  FOR INSERT WITH CHECK (true);

-- Staff can update tickets
CREATE POLICY "tickets_update_staff" ON support_tickets
  FOR UPDATE USING (is_staff());

-- Admin can delete tickets
CREATE POLICY "tickets_delete_admin" ON support_tickets
  FOR DELETE USING (is_admin());

-- ============================================================================
-- ANALYTICS POLICIES
-- ============================================================================

-- Staff can read analytics
CREATE POLICY "analytics_select_staff" ON analytics_daily
  FOR SELECT USING (is_staff());

-- Service role can manage analytics
CREATE POLICY "analytics_manage_service" ON analytics_daily
  FOR ALL USING (auth.role() = 'service_role' OR is_admin());

-- ============================================================================
-- SYSTEM SETTINGS POLICIES
-- ============================================================================

-- Staff can read settings
CREATE POLICY "settings_select_staff" ON system_settings
  FOR SELECT USING (is_staff());

-- Admin can manage settings
CREATE POLICY "settings_manage_admin" ON system_settings
  FOR ALL USING (is_admin());
