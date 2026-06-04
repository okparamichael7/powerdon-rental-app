-- Align RLS with app operator role and app_metadata (Supabase-recommended for privileges)

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'is_admin')::BOOLEAN,
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
      (auth.jwt() -> 'user_metadata' ->> 'is_admin')::BOOLEAN,
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
      FALSE
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'is_staff')::BOOLEAN,
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'operator',
      (auth.jwt() -> 'user_metadata' ->> 'is_staff')::BOOLEAN,
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'operator',
      FALSE
    ) OR is_admin()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
