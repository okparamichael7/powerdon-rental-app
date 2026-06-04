-- Enterprise staff roles: DB source of truth linked to auth.users
-- JWT app_metadata is synced on grant/revoke for fast checks; RLS reads staff_roles first.
--
-- Safe on partial DBs (no full 001): ensures shared helpers exist before triggers.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TYPE staff_role_type AS ENUM ('admin', 'operator');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS staff_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role staff_role_type NOT NULL,
  email VARCHAR(255) NOT NULL,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staff_roles_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- One active role per auth user
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_roles_active_user
  ON staff_roles (auth_user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_staff_roles_email ON staff_roles (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_staff_roles_role_active ON staff_roles (role) WHERE revoked_at IS NULL;

DROP TRIGGER IF EXISTS tr_staff_roles_updated_at ON staff_roles;
CREATE TRIGGER tr_staff_roles_updated_at
  BEFORE UPDATE ON staff_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE staff_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_roles_select_staff" ON staff_roles;
CREATE POLICY "staff_roles_select_staff" ON staff_roles
  FOR SELECT USING (is_staff() OR auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "staff_roles_manage_admin" ON staff_roles;
CREATE POLICY "staff_roles_manage_admin" ON staff_roles
  FOR ALL USING (is_admin() OR auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- RLS helpers: staff_roles table first, then legacy JWT metadata
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION staff_role_from_db(p_role staff_role_type)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM staff_roles sr
    WHERE sr.auth_user_id = auth.uid()
      AND sr.role = p_role
      AND sr.revoked_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION has_active_staff_role()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM staff_roles sr
    WHERE sr.auth_user_id = auth.uid()
      AND sr.revoked_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN staff_role_from_db('admin'::staff_role_type)
    OR COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'is_admin')::BOOLEAN,
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
      (auth.jwt() -> 'user_metadata' ->> 'is_admin')::BOOLEAN,
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
      FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_active_staff_role()
    OR COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'is_staff')::BOOLEAN,
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'operator',
      (auth.jwt() -> 'user_metadata' ->> 'is_staff')::BOOLEAN,
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'operator',
      FALSE
    )
    OR is_admin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Migrate existing metadata-based admins/operators into staff_roles (idempotent)
INSERT INTO staff_roles (auth_user_id, role, email, notes, metadata)
SELECT
  u.id,
  CASE
    WHEN COALESCE(u.raw_app_meta_data ->> 'role', u.raw_user_meta_data ->> 'role') = 'operator'
      THEN 'operator'::staff_role_type
    ELSE 'admin'::staff_role_type
  END,
  COALESCE(u.email, 'unknown@local'),
  'Auto-migrated from Supabase Auth metadata (007_staff_roles)',
  jsonb_build_object('migrated_at', NOW())
FROM auth.users u
WHERE (
  COALESCE((u.raw_app_meta_data ->> 'is_admin')::BOOLEAN, FALSE)
  OR COALESCE((u.raw_user_meta_data ->> 'is_admin')::BOOLEAN, FALSE)
  OR COALESCE(u.raw_app_meta_data ->> 'role', u.raw_user_meta_data ->> 'role') IN ('admin', 'operator')
  OR COALESCE((u.raw_app_meta_data ->> 'is_staff')::BOOLEAN, FALSE)
  OR COALESCE((u.raw_user_meta_data ->> 'is_staff')::BOOLEAN, FALSE)
)
AND NOT EXISTS (
  SELECT 1 FROM staff_roles sr
  WHERE sr.auth_user_id = u.id AND sr.revoked_at IS NULL
);
