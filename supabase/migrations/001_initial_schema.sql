-- PowerDon Rental Platform Database Schema
-- Enterprise-grade schema with full audit trail, RLS, and hardware integration

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE session_status AS ENUM ('pending', 'active', 'completed', 'expired', 'failed', 'cancelled');
CREATE TYPE station_status AS ENUM ('online', 'offline', 'maintenance', 'low_battery', 'error');
CREATE TYPE slot_status AS ENUM ('empty', 'occupied', 'reserved', 'error', 'disabled');
CREATE TYPE reward_status AS ENUM ('pending', 'qualified', 'issued', 'redeemed', 'expired', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'captured', 'refunded', 'failed', 'cancelled');
CREATE TYPE power_bank_status AS ENUM ('available', 'rented', 'charging', 'maintenance', 'lost', 'damaged');
CREATE TYPE command_type AS ENUM ('login', 'heartbeat', 'inventory', 'borrow', 'return', 'force_eject', 'reboot', 'settings', 'update');
CREATE TYPE command_status AS ENUM ('pending', 'sent', 'acknowledged', 'completed', 'failed', 'timeout');
CREATE TYPE event_type AS ENUM ('scan', 'auth', 'payment', 'unlock', 'pickup', 'return', 'reward', 'refund', 'error', 'support', 'admin');
CREATE TYPE support_category AS ENUM ('rental_issue', 'payment_issue', 'return_issue', 'reward_issue', 'station_issue', 'account_issue', 'other');
CREATE TYPE support_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE support_status AS ENUM ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed');

-- ============================================================================
-- CAMPAIGNS TABLE
-- ============================================================================

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 2.00,
  daily_cap DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 25.00,
  reward_threshold_minutes INTEGER NOT NULL DEFAULT 60,
  reward_type VARCHAR(50) NOT NULL DEFAULT 'voucher',
  reward_value DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  reward_description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT valid_date_range CHECK (end_date > start_date),
  CONSTRAINT valid_rates CHECK (hourly_rate >= 0 AND daily_cap >= 0 AND deposit_amount >= 0)
);

CREATE INDEX idx_campaigns_active ON campaigns(is_active) WHERE is_active = true;
CREATE INDEX idx_campaigns_dates ON campaigns(start_date, end_date);

-- ============================================================================
-- STATIONS TABLE (Physical station hardware)
-- ============================================================================

CREATE TABLE stations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id VARCHAR(100) UNIQUE, -- Hardware ID from protocol (e.g., IMEI)
  iccid VARCHAR(50), -- SIM card identifier
  name VARCHAR(255) NOT NULL,
  location VARCHAR(500),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  status station_status NOT NULL DEFAULT 'offline',
  total_slots INTEGER NOT NULL DEFAULT 12,
  firmware_version VARCHAR(50),
  hardware_version VARCHAR(50),
  signal_strength INTEGER, -- 0-100
  temperature DECIMAL(5,2), -- Celsius
  last_heartbeat TIMESTAMPTZ,
  last_inventory_sync TIMESTAMPTZ,
  connection_ip VARCHAR(45),
  connection_port INTEGER,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_slots CHECK (total_slots > 0 AND total_slots <= 100)
);

CREATE INDEX idx_stations_status ON stations(status);
CREATE INDEX idx_stations_campaign ON stations(campaign_id);
CREATE INDEX idx_stations_external ON stations(external_id);
CREATE INDEX idx_stations_location ON stations USING GIST (
  point(longitude, latitude)
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ============================================================================
-- STATION SLOTS TABLE (Individual slots in a station)
-- ============================================================================

CREATE TABLE station_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL,
  status slot_status NOT NULL DEFAULT 'empty',
  power_bank_id UUID, -- Will reference power_banks table
  battery_level INTEGER, -- 0-100
  is_charging BOOLEAN DEFAULT false,
  last_status_change TIMESTAMPTZ DEFAULT NOW(),
  error_code VARCHAR(50),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_station_slot UNIQUE (station_id, slot_number),
  CONSTRAINT valid_slot_number CHECK (slot_number > 0),
  CONSTRAINT valid_battery CHECK (battery_level IS NULL OR (battery_level >= 0 AND battery_level <= 100))
);

CREATE INDEX idx_slots_station ON station_slots(station_id);
CREATE INDEX idx_slots_status ON station_slots(status);
CREATE INDEX idx_slots_available ON station_slots(station_id, status) WHERE status = 'occupied';

-- ============================================================================
-- POWER BANKS TABLE
-- ============================================================================

CREATE TABLE power_banks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id VARCHAR(100) UNIQUE NOT NULL, -- Hardware ID from protocol
  model VARCHAR(100),
  capacity_mah INTEGER DEFAULT 10000,
  status power_bank_status NOT NULL DEFAULT 'available',
  current_station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  current_slot_number INTEGER,
  battery_level INTEGER,
  charge_cycles INTEGER DEFAULT 0,
  total_rental_minutes INTEGER DEFAULT 0,
  total_rentals INTEGER DEFAULT 0,
  last_maintenance TIMESTAMPTZ,
  manufactured_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_capacity CHECK (capacity_mah > 0)
);

CREATE INDEX idx_power_banks_status ON power_banks(status);
CREATE INDEX idx_power_banks_station ON power_banks(current_station_id);
CREATE INDEX idx_power_banks_external ON power_banks(external_id);

-- Add foreign key from slots to power banks
ALTER TABLE station_slots 
  ADD CONSTRAINT fk_slot_power_bank 
  FOREIGN KEY (power_bank_id) REFERENCES power_banks(id) ON DELETE SET NULL;

-- ============================================================================
-- USERS TABLE (Rental customers)
-- ============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT false,
  name VARCHAR(255),
  phone VARCHAR(50),
  phone_verified BOOLEAN DEFAULT false,
  stripe_customer_id VARCHAR(255),
  marketing_consent BOOLEAN DEFAULT false,
  marketing_consent_at TIMESTAMPTZ,
  total_rentals INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  total_rewards_earned INTEGER DEFAULT 0,
  last_rental_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE UNIQUE INDEX idx_users_email ON users(LOWER(email));
CREATE INDEX idx_users_stripe ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_users_auth ON users(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- ============================================================================
-- RENTAL SESSIONS TABLE
-- ============================================================================

CREATE TABLE rental_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_code VARCHAR(20) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  campaign_id UUID REFERENCES campaigns(id),
  
  -- Pickup details
  pickup_station_id UUID NOT NULL REFERENCES stations(id),
  pickup_slot_number INTEGER NOT NULL,
  power_bank_id UUID REFERENCES power_banks(id),
  
  -- Return details
  return_station_id UUID REFERENCES stations(id),
  return_slot_number INTEGER,
  
  -- Status tracking
  status session_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  
  -- Payment details
  deposit_amount DECIMAL(10,2) NOT NULL,
  hourly_rate DECIMAL(10,2) NOT NULL,
  daily_cap DECIMAL(10,2) NOT NULL,
  amount_charged DECIMAL(10,2) DEFAULT 0,
  amount_refunded DECIMAL(10,2) DEFAULT 0,
  payment_status payment_status NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(50),
  payment_intent_id VARCHAR(255),
  payment_authorization_id VARCHAR(255),
  
  -- Reward tracking
  reward_threshold_minutes INTEGER,
  reward_qualified BOOLEAN DEFAULT false,
  reward_status reward_status DEFAULT 'pending',
  reward_id UUID, -- Will reference rewards table
  
  -- Hardware tokens
  unlock_token VARCHAR(255),
  unlock_token_expires_at TIMESTAMPTZ,
  
  -- Audit
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_duration CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  CONSTRAINT valid_amounts CHECK (
    deposit_amount >= 0 AND 
    hourly_rate >= 0 AND 
    daily_cap >= 0 AND
    amount_charged >= 0 AND
    amount_refunded >= 0
  )
);

CREATE INDEX idx_sessions_user ON rental_sessions(user_id);
CREATE INDEX idx_sessions_status ON rental_sessions(status);
CREATE INDEX idx_sessions_code ON rental_sessions(session_code);
CREATE INDEX idx_sessions_campaign ON rental_sessions(campaign_id);
CREATE INDEX idx_sessions_pickup_station ON rental_sessions(pickup_station_id);
CREATE INDEX idx_sessions_power_bank ON rental_sessions(power_bank_id);
CREATE INDEX idx_sessions_active ON rental_sessions(user_id, status) WHERE status IN ('pending', 'active');
CREATE INDEX idx_sessions_dates ON rental_sessions(started_at DESC);

-- ============================================================================
-- SESSION EVENTS TABLE (Timeline/Audit log)
-- ============================================================================

CREATE TABLE session_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES rental_sessions(id) ON DELETE CASCADE,
  event_type event_type NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  actor_type VARCHAR(50) DEFAULT 'system', -- 'user', 'system', 'admin', 'hardware'
  actor_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_events_session ON session_events(session_id);
CREATE INDEX idx_session_events_type ON session_events(event_type);
CREATE INDEX idx_session_events_time ON session_events(created_at DESC);

-- ============================================================================
-- REWARDS TABLE
-- ============================================================================

CREATE TABLE rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  session_id UUID NOT NULL REFERENCES rental_sessions(id),
  user_id UUID NOT NULL REFERENCES users(id),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  
  reward_type VARCHAR(50) NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  description TEXT,
  
  status reward_status NOT NULL DEFAULT 'qualified',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  redeemed_at TIMESTAMPTZ,
  redemption_location VARCHAR(255),
  redeemed_by_staff_id UUID,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key from sessions to rewards
ALTER TABLE rental_sessions 
  ADD CONSTRAINT fk_session_reward 
  FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE SET NULL;

CREATE INDEX idx_rewards_user ON rewards(user_id);
CREATE INDEX idx_rewards_session ON rewards(session_id);
CREATE INDEX idx_rewards_code ON rewards(code);
CREATE INDEX idx_rewards_status ON rewards(status);
CREATE INDEX idx_rewards_expires ON rewards(expires_at) WHERE status NOT IN ('redeemed', 'expired', 'cancelled');

-- ============================================================================
-- HARDWARE COMMANDS TABLE (Command queue for stations)
-- ============================================================================

CREATE TABLE hardware_commands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  command_type command_type NOT NULL,
  slot_number INTEGER,
  payload JSONB DEFAULT '{}',
  status command_status NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 5, -- 1=highest, 10=lowest
  
  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes'),
  
  -- Response
  response_code INTEGER,
  response_data JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Context
  session_id UUID REFERENCES rental_sessions(id) ON DELETE SET NULL,
  triggered_by UUID, -- admin user or system
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_commands_station ON hardware_commands(station_id);
CREATE INDEX idx_commands_status ON hardware_commands(status);
CREATE INDEX idx_commands_pending ON hardware_commands(station_id, status, priority, created_at) 
  WHERE status IN ('pending', 'sent');
CREATE INDEX idx_commands_session ON hardware_commands(session_id) WHERE session_id IS NOT NULL;

-- ============================================================================
-- HARDWARE EVENTS TABLE (Raw hardware communication log)
-- ============================================================================

CREATE TABLE hardware_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  station_external_id VARCHAR(100), -- Backup if station not yet registered
  event_type VARCHAR(50) NOT NULL, -- 'login', 'heartbeat', 'inventory', 'borrow', 'return', etc.
  direction VARCHAR(10) NOT NULL, -- 'inbound', 'outbound'
  raw_data BYTEA, -- Original binary message
  parsed_data JSONB, -- Decoded message
  command_id UUID REFERENCES hardware_commands(id) ON DELETE SET NULL,
  response_code INTEGER,
  processing_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hardware_events_station ON hardware_events(station_id);
CREATE INDEX idx_hardware_events_time ON hardware_events(created_at DESC);
CREATE INDEX idx_hardware_events_type ON hardware_events(event_type);
-- Partition by month for efficient cleanup (example for future)
-- Consider partitioning this table if volume is high

-- ============================================================================
-- SUPPORT TICKETS TABLE
-- ============================================================================

CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number VARCHAR(20) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  session_id UUID REFERENCES rental_sessions(id),
  
  category support_category NOT NULL,
  priority support_priority NOT NULL DEFAULT 'medium',
  status support_status NOT NULL DEFAULT 'open',
  
  subject VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  
  assigned_to UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tickets_user ON support_tickets(user_id);
CREATE INDEX idx_tickets_session ON support_tickets(session_id);
CREATE INDEX idx_tickets_status ON support_tickets(status);
CREATE INDEX idx_tickets_priority ON support_tickets(priority, status) WHERE status NOT IN ('resolved', 'closed');

-- ============================================================================
-- ANALYTICS AGGREGATES TABLE (Pre-computed metrics)
-- ============================================================================

CREATE TABLE analytics_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  
  -- Session metrics
  total_sessions INTEGER DEFAULT 0,
  completed_sessions INTEGER DEFAULT 0,
  failed_sessions INTEGER DEFAULT 0,
  cancelled_sessions INTEGER DEFAULT 0,
  total_duration_minutes INTEGER DEFAULT 0,
  avg_duration_minutes DECIMAL(10,2) DEFAULT 0,
  
  -- Revenue metrics
  total_revenue DECIMAL(10,2) DEFAULT 0,
  total_deposits DECIMAL(10,2) DEFAULT 0,
  total_refunds DECIMAL(10,2) DEFAULT 0,
  
  -- Reward metrics
  rewards_qualified INTEGER DEFAULT 0,
  rewards_issued INTEGER DEFAULT 0,
  rewards_redeemed INTEGER DEFAULT 0,
  rewards_value_issued DECIMAL(10,2) DEFAULT 0,
  rewards_value_redeemed DECIMAL(10,2) DEFAULT 0,
  
  -- User metrics
  unique_users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  returning_users INTEGER DEFAULT 0,
  
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_daily_aggregate UNIQUE (date, campaign_id, station_id)
);

CREATE INDEX idx_analytics_date ON analytics_daily(date DESC);
CREATE INDEX idx_analytics_campaign ON analytics_daily(campaign_id);
CREATE INDEX idx_analytics_station ON analytics_daily(station_id);

-- ============================================================================
-- SYSTEM SETTINGS TABLE
-- ============================================================================

CREATE TABLE system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default settings
INSERT INTO system_settings (key, value, description) VALUES
  ('tcp_server', '{"enabled": true, "port": 8088, "host": "0.0.0.0", "timeout_ms": 30000}', 'TCP server configuration for station connections'),
  ('heartbeat', '{"interval_seconds": 60, "timeout_seconds": 180, "max_missed": 3}', 'Station heartbeat settings'),
  ('rental', '{"max_duration_hours": 24, "grace_period_minutes": 15, "auto_expire_hours": 48}', 'Rental session settings'),
  ('rewards', '{"default_expiry_days": 30, "code_length": 8, "code_prefix": "PD"}', 'Reward settings'),
  ('notifications', '{"email_enabled": true, "sms_enabled": false}', 'Notification settings');

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to generate session code
CREATE OR REPLACE FUNCTION generate_session_code()
RETURNS VARCHAR(20) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result VARCHAR(20) := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to generate reward code
CREATE OR REPLACE FUNCTION generate_reward_code()
RETURNS VARCHAR(50) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result VARCHAR(50) := 'PD-';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN 'TKT-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to update station availability count
CREATE OR REPLACE FUNCTION update_station_availability()
RETURNS TRIGGER AS $$
BEGIN
  -- This would be called to update cached availability
  -- Implementation depends on caching strategy
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate session charges
CREATE OR REPLACE FUNCTION calculate_session_charge(
  p_duration_minutes INTEGER,
  p_hourly_rate DECIMAL,
  p_daily_cap DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
  RETURN LEAST((p_duration_minutes::DECIMAL / 60) * p_hourly_rate, p_daily_cap);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER tr_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_stations_updated_at BEFORE UPDATE ON stations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_station_slots_updated_at BEFORE UPDATE ON station_slots FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_power_banks_updated_at BEFORE UPDATE ON power_banks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_rental_sessions_updated_at BEFORE UPDATE ON rental_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_rewards_updated_at BEFORE UPDATE ON rewards FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_support_tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-generate session code
CREATE OR REPLACE FUNCTION set_session_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.session_code IS NULL OR NEW.session_code = '' THEN
    NEW.session_code := generate_session_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_session_code BEFORE INSERT ON rental_sessions FOR EACH ROW EXECUTE FUNCTION set_session_code();

-- Auto-generate reward code
CREATE OR REPLACE FUNCTION set_reward_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := generate_reward_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_reward_code BEFORE INSERT ON rewards FOR EACH ROW EXECUTE FUNCTION set_reward_code();

-- Auto-generate ticket number
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_ticket_number BEFORE INSERT ON support_tickets FOR EACH ROW EXECUTE FUNCTION set_ticket_number();

-- Log session events on status change
CREATE OR REPLACE FUNCTION log_session_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO session_events (session_id, event_type, description, metadata, actor_type)
    VALUES (
      NEW.id,
      CASE NEW.status
        WHEN 'active' THEN 'unlock'
        WHEN 'completed' THEN 'return'
        WHEN 'failed' THEN 'error'
        WHEN 'cancelled' THEN 'admin'
        ELSE 'admin'
      END,
      'Session status changed from ' || OLD.status || ' to ' || NEW.status,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
      'system'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_session_status_change 
  AFTER UPDATE ON rental_sessions 
  FOR EACH ROW 
  EXECUTE FUNCTION log_session_status_change();

-- Update user stats on session completion
CREATE OR REPLACE FUNCTION update_user_stats_on_session()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE users SET
      total_rentals = total_rentals + 1,
      total_spent = total_spent + COALESCE(NEW.amount_charged, 0),
      last_rental_at = NOW(),
      updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_user_stats 
  AFTER UPDATE ON rental_sessions 
  FOR EACH ROW 
  EXECUTE FUNCTION update_user_stats_on_session();

-- Update power bank stats on return
CREATE OR REPLACE FUNCTION update_power_bank_on_return()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status = 'active' AND NEW.power_bank_id IS NOT NULL THEN
    UPDATE power_banks SET
      total_rentals = total_rentals + 1,
      total_rental_minutes = total_rental_minutes + COALESCE(NEW.duration_minutes, 0),
      current_station_id = NEW.return_station_id,
      current_slot_number = NEW.return_slot_number,
      status = 'charging',
      updated_at = NOW()
    WHERE id = NEW.power_bank_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_power_bank 
  AFTER UPDATE ON rental_sessions 
  FOR EACH ROW 
  EXECUTE FUNCTION update_power_bank_on_return();
