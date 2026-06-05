# Production Setup

End-to-end guide to run Powerdon in production: **Vercel** (Next.js app), **Hetzner VPS** (always-on TCP proxy for WsCharge cabinets), **Supabase** (database + auth), and **Stripe** (rentals).

For local development, see [LOCAL_SETUP_AND_TESTING.md](./LOCAL_SETUP_AND_TESTING.md).

---

## Architecture

```text
┌─────────────────┐     TCP :8088      ┌──────────────────────┐
│ WsCharge        │ ─────────────────► │ Hetzner VPS          │
│ cabinet         │                    │ server/tcp-proxy.ts  │
└─────────────────┘                    │ PM2, ports 8088/8089 │
                                       └──────────┬───────────┘
                                                  │ HTTPS
                                                  │ POST /api/stations/message
                                                  ▼
┌─────────────────┐     HTTPS          ┌──────────────────────┐
│ Customer PWA    │ ─────────────────► │ Vercel (Next.js)     │
│ Admin dashboard │                    │ API routes, Stripe   │
└─────────────────┘                    └──────────┬───────────┘
                                                    │
                                                    ▼
                                         ┌──────────────────────┐
                                         │ Supabase               │
                                         │ Postgres + Auth        │
                                         └──────────────────────┘
```

| Component | Host | Role |
|-----------|------|------|
| **Next.js app** | Vercel | PWA, admin, Stripe webhooks, station message API |
| **TCP proxy** | Hetzner (or any VPS) | Cabinet TCP ↔ HTTP bridge; **not** on Vercel |
| **Database** | Supabase | Stations, rentals, users, staff roles, hardware logs |
| **Payments** | Stripe | Checkout, holds, webhooks to Vercel |

---

## Prerequisites

- GitHub repo connected to **Vercel** (auto-deploy on `main` is fine).
- **Supabase** project (apply migrations — see below).
- **Stripe** account (live keys for production).
- **Hetzner** (or other) VPS with public IPv4, ports **8088** and **8089** open.
- Domain for the app (Vercel custom domain) optional but recommended for `NEXT_PUBLIC_APP_URL`.

---

## Setup order (recommended)

Complete these in order so tokens and URLs stay consistent.

### 1. Supabase — schema and auth

1. In Supabase **SQL Editor**, run migrations in order (skip any already applied):
   - `supabase/migrations/002_rls_policies.sql`
   - `003_*`, `004_complete_missing_schema.sql`
   - `005_enterprise_hardening.sql`
   - `006_rls_staff_operator.sql`
   - `007_staff_roles.sql`
   - `008_staff_audit_log.sql`
   - `009_rental_sessions_schema_sync.sql` (partial `rental_sessions` — required for admin sessions/analytics)
   - `010_rewards_schema_sync.sql` (partial `rewards` — required for admin rewards + redemption metadata)
2. **Authentication → Providers**: enable Email (and any OAuth you use).
3. **Authentication → URL configuration**: set **Site URL** and redirect URLs to your production app, e.g. `https://your-app.vercel.app`.
4. Copy **Project URL**, **anon key**, and **service_role key** (server only — never expose service role to the browser).

Details: [STAFF_ACCESS.md](./STAFF_ACCESS.md) for admin vs renter users.

---

### 2. Generate shared secrets

On your machine:

```bash
openssl rand -hex 32
```

Use one value for both (must match on Vercel and the proxy):

- `STATION_PROXY_TOKEN` (Vercel)
- `API_AUTH_TOKEN` (Hetzner `.env.proxy`)

Generate separate values for:

- `CRON_SECRET` — `Authorization: Bearer` for `/api/cron/maintenance`
- `METRICS_API_KEY` — optional, for `/api/metrics` if you use it

---

### 3. Vercel — environment variables

1. **Project → Settings → Environment Variables**
2. Add variables for **Production** (full list: [VERCEL_ENV.md](./VERCEL_ENV.md)).

**Minimum production set:**

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://your-production-domain

STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

STATION_PROXY_TOKEN=
TCP_PROXY_URL=https://YOUR_HETZNER_IP:8089

CRON_SECRET=
WSCHARGE_ENABLED=true
```

Optional but recommended: `METRICS_API_KEY`, `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`, `BOOTSTRAP_ADMIN_EMAIL`, `RESEND_API_KEY` + `EMAIL_FROM`.

3. **Redeploy** after saving env vars.

**Do not set on Vercel:** `TCP_PORT`, `TCP_HOST`, `API_BASE_URL` (proxy-only).  
**Do not set in production:** `NEXT_PUBLIC_USE_MOCK_DATA=true`, `ALLOW_INSECURE_HARDWARE_DEV=true`.

---

### 4. Hetzner — TCP proxy

The proxy must run 24/7; Vercel cannot accept cabinet TCP connections.

Follow the step-by-step guide: **[HETZNER_TCP_PROXY_SETUP.md](./HETZNER_TCP_PROXY_SETUP.md)**

Summary:

| Setting | Proxy (Hetzner) | Vercel |
|---------|-----------------|--------|
| `TCP_PORT` | `8088` (cabinets) | — |
| `WS_PORT` | `8089` (health / `TCP_PROXY_URL`) | — |
| `API_BASE_URL` | `https://your-app.vercel.app` | — |
| `API_AUTH_TOKEN` | same as `STATION_PROXY_TOKEN` | `STATION_PROXY_TOKEN` |
| `TCP_PROXY_URL` | — | `https://HETZNER_IP:8089` |

Cabinet config: point the station server IP to the **Hetzner public IP**, port **8088**.

---

### 5. Stripe — live mode

1. Switch to **Live** mode in Stripe Dashboard.
2. **Developers → API keys** → copy live publishable + secret keys to Vercel.
3. **Developers → Webhooks** → add endpoint:
   - **URL:** `https://your-production-domain/api/webhooks/stripe`
   - **Events:** `checkout.session.completed`, `checkout.session.expired`, `payment_intent.amount_capturable_updated`, `payment_intent.payment_failed`, `payment_intent.canceled`, `payment_intent.succeeded`, `charge.refunded` (add dispute events if needed)
4. Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET` on Vercel, then redeploy.

Use **all live** or **all test** keys; never mix modes.

Rental flow reference: [PWA_RENTAL_FLOW.md](./PWA_RENTAL_FLOW.md).

---

### 6. Admin / staff access

1. Create a user in **Supabase Auth** (or sign up via `/admin/login` if enabled).
2. Either:
   - Set `BOOTSTRAP_ADMIN_EMAIL` on Vercel to that email (first login grants admin when `staff_roles` is empty), or
   - After first admin exists, use **Admin → Staff** at `/admin/staff`, or
   - Insert into `staff_roles` via SQL (see [STAFF_ACCESS.md](./STAFF_ACCESS.md)).

Admins use **`staff_roles` + Auth**, not the `public.users` table.

---

### 7. Stations in database

Register each cabinet in Supabase (or admin UI) with:

- `external_id` matching the WsCharge station ID
- Network reachability to Hetzner **:8088**
- Correct RLS / operator scope if using multi-tenant staff

Hardware testing: [TESTING_REAL_STATION.md](./TESTING_REAL_STATION.md).

---

### 8. Cron / maintenance

Schedule a daily (or hourly) job:

```http
POST https://your-production-domain/api/cron/maintenance
Authorization: Bearer <CRON_SECRET>
```

Use **Vercel Cron** (`vercel.json`) or an external scheduler. `CRON_SECRET` must match Vercel env.

---

### 9. Optional hardening

| Item | Doc / action |
|------|----------------|
| Distributed rate limits | `UPSTASH_REDIS_REST_*` on Vercel — [VERCEL_ENV.md](./VERCEL_ENV.md) |
| Alerts | `SLACK_WEBHOOK_URL` / `ALERT_WEBHOOK_URL` |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` |
| Ops / health | `/admin/ops`, `/api/health` |
| Security audit status | [POST_IMPLEMENTATION_VERIFICATION.md](./POST_IMPLEMENTATION_VERIFICATION.md) |

---

### 10. Go-live verification

Run this checklist after deploy:

| # | Check | Expected |
|---|--------|----------|
| 1 | `GET https://your-app.vercel.app/api/health` | Healthy JSON; `wscharge` / stations if configured |
| 2 | `GET http://HETZNER_IP:8089/health` (or proxy health path) | Proxy up |
| 3 | Cabinet online | Heartbeat / station visible in admin or DB |
| 4 | `POST /api/stations/message` auth | Rejects requests without correct `STATION_PROXY_TOKEN` |
| 5 | Admin login | `/admin` works for `staff_roles` user |
| 6 | Stripe webhook | Dashboard shows successful delivery to `/api/webhooks/stripe` |
| 7 | Test rental (live or test mode) | Checkout → unlock path uses station `external_id` |
| 8 | Cron | Maintenance endpoint returns 200 with bearer token |

---

## Production vs local (quick reference)

| Variable | Local | Production |
|----------|-------|------------|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://your-domain` |
| `API_BASE_URL` (proxy) | `http://localhost:3000` | `https://your-domain` |
| `TCP_PROXY_URL` (Vercel) | `http://localhost:8089` | `https://HETZNER_IP:8089` |
| Stripe | Test keys | Live keys + live webhook |
| Hardware dev bypass | Optional `ALLOW_INSECURE_HARDWARE_DEV` | **Never** |

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Cabinet offline | Firewall blocked **8088** on Hetzner; wrong cabinet IP/port |
| Proxy cannot reach app | Wrong `API_BASE_URL`; Vercel deployment down; token mismatch |
| `401` on station messages | `STATION_PROXY_TOKEN` ≠ `API_AUTH_TOKEN` |
| Admin “access denied” | No row in `staff_roles`; run `007` migration |
| Stripe webhook fails | Wrong URL; mixed test/live keys; redeploy after secret change |
| Rental unlock fails | Station `external_id` mismatch; proxy offline |

Operations detail: [wscharge/RUNBOOK.md](./wscharge/RUNBOOK.md).

---

## Related documentation

| Document | Purpose |
|----------|---------|
| [VERCEL_ENV.md](./VERCEL_ENV.md) | Full Vercel variable list |
| [HETZNER_TCP_PROXY_SETUP.md](./HETZNER_TCP_PROXY_SETUP.md) | VPS + PM2 + proxy `.env` |
| [STAFF_ACCESS.md](./STAFF_ACCESS.md) | Admin bootstrap and roles |
| [PWA_RENTAL_FLOW.md](./PWA_RENTAL_FLOW.md) | Customer rental + Stripe |
| [TESTING_REAL_STATION.md](./TESTING_REAL_STATION.md) | Physical cabinet tests |
| [POST_IMPLEMENTATION_VERIFICATION.md](./POST_IMPLEMENTATION_VERIFICATION.md) | Security / readiness audit |
| [LOCAL_SETUP_AND_TESTING.md](./LOCAL_SETUP_AND_TESTING.md) | Dev environment |

---

## Security reminders

- Never commit `.env`, `.env.local`, or `.env.proxy`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `STRIPE_SECRET_KEY` to the client.
- Rotate `STATION_PROXY_TOKEN` / `CRON_SECRET` if leaked.
- Keep `pnpm-lock.yaml` / dependencies updated; review [POST_IMPLEMENTATION_VERIFICATION.md](./POST_IMPLEMENTATION_VERIFICATION.md) before high-traffic launch.
