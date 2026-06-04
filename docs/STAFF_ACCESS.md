# Staff Access (Enterprise)

PowerDon separates **rental customers** from **dashboard staff**:

| Store | Table / system | Who |
|-------|----------------|-----|
| Renters | `public.users` | PWA customers (email, Stripe, sessions) |
| Staff | `public.staff_roles` + `auth.users` | Admin portal operators |

## Source of truth

1. **`staff_roles`** — active row per `auth_user_id` (`admin` or `operator`, `revoked_at` null)
2. **`auth.users.app_metadata`** — synced on grant/revoke for JWT alignment
3. **Legacy JWT `user_metadata`** — fallback only if no DB row (migration 007 imports existing metadata users)

RLS functions `is_admin()` and `is_staff()` check **`staff_roles` first**, then JWT.

## First-time setup

1. Apply migrations **`007_staff_roles.sql`** and **`008_staff_audit_log.sql`** in Supabase SQL Editor.
2. Create a user under **Authentication → Users** (email + password).
3. Either:
   - **Bootstrap:** set `BOOTSTRAP_ADMIN_EMAIL=that@email.com` in `.env`, sign in at `/admin/login` (creates first admin row), or
   - **SQL:**  
     `INSERT INTO staff_roles (auth_user_id, role, email) SELECT id, 'admin', email FROM auth.users WHERE email = 'you@example.com';`  
     then call sync via Admin → Staff grant, or sign in once after metadata migration.
4. Migration **007** auto-imports users who already had `app_metadata` / `user_metadata` admin flags.

## Managing staff (production)

- **Admin UI:** `/admin/staff` (admin role only)
- **API:** `GET/POST /api/admin/staff`, `DELETE /api/admin/staff/:authUserId`

Operators can use most of the dashboard; only **admins** can grant/revoke staff.

## Roles

| Role | Capabilities |
|------|----------------|
| `admin` | Full dashboard + staff management + destructive RLS policies |
| `operator` | Read/update ops data; cannot manage `staff_roles` |

## Do not use `public.users` for staff

The `users` table is for renters. Linking staff there would mix billing/analytics with operators. Staff always use **Supabase Auth** + **`staff_roles`**.

## Related

- [LOCAL_SETUP_AND_TESTING.md](./LOCAL_SETUP_AND_TESTING.md)
- Migration: `supabase/migrations/007_staff_roles.sql`
