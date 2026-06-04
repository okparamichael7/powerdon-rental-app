-- Audit trail for staff role grants/revokes (enterprise accountability)

CREATE TABLE IF NOT EXISTS staff_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(32) NOT NULL CHECK (action IN ('grant', 'revoke', 'role_change')),
  role staff_role_type,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_audit_target ON staff_audit_log (target_auth_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_audit_actor ON staff_audit_log (actor_auth_user_id, created_at DESC);

ALTER TABLE staff_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_audit_select_admin" ON staff_audit_log;
CREATE POLICY "staff_audit_select_admin" ON staff_audit_log
  FOR SELECT USING (is_admin() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "staff_audit_insert_service" ON staff_audit_log;
CREATE POLICY "staff_audit_insert_service" ON staff_audit_log
  FOR ALL USING (auth.role() = 'service_role' OR is_admin());
