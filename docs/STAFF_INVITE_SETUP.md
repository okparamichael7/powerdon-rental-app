# Staff Invite-by-Email Setup

Configure Supabase and your app so admins can provision staff via **Send invite** on `/admin/staff`.

Invites use Supabase Auth `inviteUserByEmail` with this redirect (see `lib/admin/staff-invite.ts`):

```text
{NEXT_PUBLIC_APP_URL}/auth/callback?next=/admin
```

After the user sets their password from the email link, Supabase redirects to `/auth/callback`, the app exchanges the auth code for a session, then sends them to `/admin`.

---

## 1. Supabase → Authentication → URL Configuration

### Site URL

Set this to your app origin (no trailing slash):

| Environment | Site URL |
|-------------|----------|
| Production | `https://your-app.vercel.app` (or your custom domain) |
| Local dev | `http://localhost:3000` |

### Redirect URLs (allowlist)

Add every origin where invites should work:

```text
http://localhost:3000/auth/callback
https://your-app.vercel.app/auth/callback
```

If you use a custom domain:

```text
https://admin.yourcompany.com/auth/callback
```

**Optional** (Vercel preview deploys):

```text
https://*.vercel.app/auth/callback
```

Supabase matches the path `/auth/callback`; the `?next=/admin` query is fine once that path is allowed.

---

## 2. Supabase → Authentication → Email (SMTP)

Invite emails are sent by **Supabase Auth**, not Resend.

1. Go to **Authentication → Email** (or **SMTP Settings**).
2. Configure custom SMTP (recommended for production):
   - Resend, SendGrid, AWS SES, etc.
   - Supabase’s built-in mail is fine for testing but has low limits.
3. Set a proper **sender** (e.g. `noreply@yourdomain.com`) and verify the domain with your provider.
4. Under **Email Templates → Invite user**, review the template (optional branding/copy).

Without working SMTP, invites will fail or never arrive.

---

## 3. App environment variables

In `.env` / Vercel, you need at least:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | **Required for invites** — must match Site URL (e.g. `https://your-app.vercel.app`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth callback session exchange |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side `inviteUserByEmail` (never expose to browser) |

If `NEXT_PUBLIC_APP_URL` is missing, invite returns **503** (`INVITE_CONFIG`).

See also: [.env.example](../.env.example), [VERCEL_ENV.md](./VERCEL_ENV.md).

---

## 4. Database / staff setup (one-time)

1. Run migrations **`007_staff_roles.sql`** and **`008_staff_audit_log.sql`** in Supabase.
2. Have at least one admin:
   - Set `BOOTSTRAP_ADMIN_EMAIL` and sign in once at `/admin/login`, or
   - Create the first admin via **Set password** on `/admin/staff`.
3. Sign in as admin → **Staff** → **Send invite** tab.

Related: [STAFF_ACCESS.md](./STAFF_ACCESS.md).

---

## 5. How to test

1. Set `NEXT_PUBLIC_APP_URL=http://localhost:3000` locally.
2. Add `http://localhost:3000/auth/callback` to Supabase redirect URLs.
3. Configure SMTP (or use Supabase test mail).
4. As admin, invite a **new** email (not already in Auth).
5. Open the invite email → set password → you should land on `/admin`.

---

## 6. Gotchas

| Situation | What happens |
|-----------|----------------|
| **Email already in Supabase Auth** | No new invite email; staff role is granted; they sign in or use **Forgot password** on `/admin/login`. |
| **Redirect URL mismatch** | Link opens but auth fails or redirects wrong — fix allowlist + `NEXT_PUBLIC_APP_URL`. |
| **Wrong `NEXT_PUBLIC_APP_URL` in prod** | Invite links point at localhost or wrong domain. |
| **No SMTP** | Invite API may succeed but no email is delivered. |
| **Existing staff email** | `409 ALREADY_STAFF` — revoke first if re-provisioning. |

---

## Quick checklist

- [ ] Site URL = your app URL
- [ ] Redirect URL(s) include `/auth/callback` for prod + local (and previews if needed)
- [ ] Custom SMTP configured and tested
- [ ] `NEXT_PUBLIC_APP_URL` set in Vercel/.env
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set (server only)
- [ ] Staff migrations applied
- [ ] At least one admin exists
- [ ] Test invite to a fresh email address

---

## Password vs invite

**Set password** on `/admin/staff` does not depend on Supabase email or redirect URLs.

**Send invite** requires SMTP, URL configuration, and `NEXT_PUBLIC_APP_URL` as described above.
