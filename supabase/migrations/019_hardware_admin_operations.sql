-- Hardware admin operations: extended station metadata, audit trail, maintenance records

ALTER TABLE stations
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS hardware_type VARCHAR(100) DEFAULT 'power_bank_cabinet',
  ADD COLUMN IF NOT EXISTS qr_reference TEXT,
  ADD COLUMN IF NOT EXISTS external_service_ref TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stations_archived ON stations(archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stations_hardware_type ON stations(hardware_type);
CREATE INDEX IF NOT EXISTS idx_stations_enabled_not_archived ON stations(is_enabled) WHERE archived_at IS NULL;

ALTER TABLE station_slots
  ADD COLUMN IF NOT EXISTS label VARCHAR(100);

-- Hardware admin audit log (distinct from staff_audit_log)
CREATE TABLE IF NOT EXISTS hardware_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  slot_number INTEGER,
  action VARCHAR(80) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hardware_audit_station ON hardware_audit_log(station_id);
CREATE INDEX IF NOT EXISTS idx_hardware_audit_created ON hardware_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hardware_audit_action ON hardware_audit_log(action);

-- Station maintenance records
CREATE TABLE IF NOT EXISTS station_maintenance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  slot_number INTEGER,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_maintenance_status CHECK (status IN ('open', 'in_progress', 'resolved', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_station_maintenance_station ON station_maintenance_records(station_id);
CREATE INDEX IF NOT EXISTS idx_station_maintenance_status ON station_maintenance_records(status);

CREATE TRIGGER tr_station_maintenance_updated_at
  BEFORE UPDATE ON station_maintenance_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE hardware_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_maintenance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hardware_audit_staff_select ON hardware_audit_log;
CREATE POLICY hardware_audit_staff_select ON hardware_audit_log
  FOR SELECT USING (is_staff());

DROP POLICY IF EXISTS hardware_audit_admin_insert ON hardware_audit_log;
CREATE POLICY hardware_audit_admin_insert ON hardware_audit_log
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS station_maintenance_staff_select ON station_maintenance_records;
CREATE POLICY station_maintenance_staff_select ON station_maintenance_records
  FOR SELECT USING (is_staff());

DROP POLICY IF EXISTS station_maintenance_admin_write ON station_maintenance_records;
CREATE POLICY station_maintenance_admin_write ON station_maintenance_records
  FOR ALL USING (is_admin());
