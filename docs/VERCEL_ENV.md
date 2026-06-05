# Vercel Environment Variables

Powerdon on **Vercel** runs **Next.js only**. The **TCP proxy** (cabinet connections on port **8088**) must run on a separate host (VPS, Railway, etc.). This guide lists what to configure in **Vercel → Project → Settings → Environment Variables**.

**Related:** [.env.example](../.env.example), [LOCAL_SETUP_AND_TESTING.md](./LOCAL_SETUP_AND_TESTING.md), [TESTING_REAL_STATION.md](./TESTING_REAL_STATION.md)

---

## Architecture reminder

```text
Cabinet → TCP :8088 (proxy VPS) → tcp-proxy → Vercel /api/stations/message
PWA / Admin → Vercel (Next.js)
Stripe → Vercel /api/webhooks/stripe
```

On Vercel you set `TCP_PROXY_URL` to the proxy’s **HTTP** endpoint (port **8089**), not `localhost`.

---

## Required on Vercel (production)

| Variable | Example / notes |
|----------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → **anon** |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** (server only; never expose to browser) |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` (no trailing slash) |
| `STRIPE_SECRET_KEY` | `sk_live_...` (or `sk_test_...` for Preview) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` / `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` for `https://your-app.vercel.app/api/webhooks/stripe` |
| `STATION_PROXY_TOKEN` | Shared secret with TCP proxy (`openssl rand -hex 32`) |
| `TCP_PROXY_URL` | Proxy HTTP URL, e.g. `http://YOUR_VPS_IP:8089` or `https://proxy.yourdomain.com` |
| `CRON_SECRET` | Random secret; Vercel Cron → `POST /api/cron/maintenance` with `Authorization: Bearer <secret>` |
| `METRICS_API_KEY` | Random secret if `/api/metrics` is protected |

### Production safety (explicit)

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` (Vercel sets automatically) |
| `NEXT_PUBLIC_USE_MOCK_DATA` | **Unset** or `false` (PWA only; admin ignores this) |
| `NEXT_PUBLIC_ADMIN_USE_MOCK_DATA` | **Unset** or `false` (admin demo mode only) |
| `ALLOW_INSECURE_HARDWARE_DEV` | **Unset** or `false` |

After deploy, check `https://your-app.vercel.app/api/health` → `productionReady: true` when required vars are set.

---

## Strongly recommended

| Variable | Purpose |
|----------|---------|
| `BOOTSTRAP_ADMIN_EMAIL` | First admin on `/admin/login` when `staff_roles` is empty (remove after bootstrap) |
| `ADMIN_API_KEY` | Headless admin API access (see `proxy.ts`) |
| `INTERNAL_API_KEY` | Internal billing / finalize-return between services |
| `WSCHARGE_ENABLED` | `true` |
| `UPSTASH_REDIS_REST_URL` | Distributed rate limits (multi-instance) |
| `UPSTASH_REDIS_REST_TOKEN` | Pair with URL above |

---

## Optional (enable when needed)

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Transactional email |
| `EMAIL_FROM` | e.g. `Powerdon <noreply@yourdomain.com>` |
| `SLACK_WEBHOOK_URL` | Alerting |
| `ALERT_WEBHOOK_URL` | Alerting |
| `PAGERDUTY_ROUTING_KEY` | Alerting |
| `TCP_PROXY_API_KEY` | Alternative name; can match `STATION_PROXY_TOKEN` |
| `LOG_LEVEL` | e.g. `info` |
| `SERVICE_NAME` | Logging label |
| `APP_VERSION` | Shown in `/api/health` |
| `ALLOWED_IPS` | Comma-separated IP allowlist for internal endpoints |

---

## TCP proxy on Hetzner (step-by-step)

See **[HETZNER_TCP_PROXY_SETUP.md](./HETZNER_TCP_PROXY_SETUP.md)** for a full beginner guide (create VPS, firewall, PM2, env, cabinet IP).

## Do not put on Vercel (TCP proxy host only)

These belong on the machine running `npm run tcp-proxy` / `server/tcp-proxy.ts`:

| Variable | Typical value on proxy host |
|----------|---------------------------|
| `TCP_PORT` | `8088` (cabinet TCP) |
| `TCP_HOST` | `0.0.0.0` |
| `WS_PORT` | `8089` (proxy HTTP/health) |
| `API_BASE_URL` | `https://your-app.vercel.app` |
| `API_AUTH_TOKEN` | **Same** as Vercel `STATION_PROXY_TOKEN` |
| `STATION_PROXY_TOKEN` | Same shared secret |

Vercel only needs **`TCP_PROXY_URL`** pointing at the proxy HTTP URL (port **8089**).

---

## Stripe on Vercel

1. **Developers → API keys** → copy publishable + secret (test or live).
2. **Developers → Webhooks** → add destination:
   - **URL:** `https://your-app.vercel.app/api/webhooks/stripe`
   - **Events:** `checkout.session.completed`, `checkout.session.expired`, `payment_intent.amount_capturable_updated`, `payment_intent.payment_failed`, `payment_intent.canceled`, `payment_intent.succeeded`, `charge.refunded` (and dispute events if desired)
3. Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET` on Vercel.

Use **all test** or **all live** keys; do not mix modes.

---

## Minimal copy-paste block (Production)

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

STATION_PROXY_TOKEN=
TCP_PROXY_URL=https://your-tcp-proxy-host:8089

CRON_SECRET=
METRICS_API_KEY=
WSCHARGE_ENABLED=true
```

---

## Vercel UI checklist

1. **Project → Settings → Environment Variables**
2. Add variables for **Production** (and **Preview** with test Stripe keys if desired).
3. `NEXT_PUBLIC_*` vars are exposed to the browser — only public keys there.
4. **Redeploy** after changes.
5. Schedule cron: `POST https://your-app.vercel.app/api/cron/maintenance` with `Authorization: Bearer <CRON_SECRET>` (Vercel Cron or external scheduler).

---

## Preview vs Production

| Environment | Stripe | `NEXT_PUBLIC_APP_URL` |
|-------------|--------|------------------------|
| **Preview** | `sk_test_` / `pk_test_` | Preview deployment URL or branch URL |
| **Production** | `sk_live_` / `pk_live_` | Production domain |

Webhook signing secrets are **per endpoint** — use a separate Stripe webhook (or CLI) for preview if needed.

---

## Related docs

- [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md) — full production checklist (Vercel + Hetzner + Supabase + Stripe)
- [STAFF_ACCESS.md](./STAFF_ACCESS.md) — admin bootstrap on Vercel
- [wscharge/RUNBOOK.md](./wscharge/RUNBOOK.md) — proxy operations
- [PWA_RENTAL_FLOW.md](./PWA_RENTAL_FLOW.md) — rental + Stripe flow
