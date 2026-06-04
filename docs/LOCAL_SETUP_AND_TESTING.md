# Local Setup and Testing Guide

Use this guide after applying Supabase migrations (`002`, `003`, `004`) to verify the PowerDon rental app and WsCharge v5.8P integration.

## Prerequisites

- Node.js 18+ installed
- Supabase project with migrations applied
- (Optional) Physical charging cabinet on your network for full hardware tests
- (Optional) Stripe account for payment/rental checkout tests

---

## 1. Environment (`.env.local`)

Copy from `.env.example` into `.env.local` and fill at minimum:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | PWA / client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server APIs (stations, rentals, hardware logs) |
| `STATION_PROXY_TOKEN` | Auth for TCP proxy → Next.js (`openssl rand -hex 32`) |
| `API_AUTH_TOKEN` | **Same value** as `STATION_PROXY_TOKEN` for `server/tcp-proxy.ts` |
| `TCP_PROXY_URL` | `http://localhost:8089` (proxy HTTP/health port) |
| `API_BASE_URL` | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` |

### Admin access

Configure Supabase Auth and an admin user (e.g. `user_metadata.is_admin: true`) to use `/admin/*`.

### Payments (optional)

Add Stripe keys for full rental checkout:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### Mock data

Do **not** set `NEXT_PUBLIC_USE_MOCK_DATA=true` if you want real database behavior.

Dev-only hardware bypass (no proxy token):

```env
ALLOW_INSECURE_HARDWARE_DEV=true
```

Only use in local development, never in production.

### Install dependencies

```bash
npm install
```

---

## 2. Database

You should have already run:

1. `001_initial_schema.sql` (or partial schema + `004`)
2. `004_complete_missing_schema.sql`
3. `003_wscharge_hardware_idempotency.sql`
4. `002_rls_policies.sql`

### Sanity check (Supabase SQL editor)

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'hardware_events',
    'hardware_commands',
    'station_slots',
    'stations'
  )
ORDER BY 1;
```

You should see all four tables.

### Seed a test station

In Supabase Table Editor → `stations`, insert at least one row:

- `external_id`: cabinet serial (e.g. `TEST-CABINET-001`) or your real cabinet SN
- `name`: any label
- `is_enabled`: `true`
- `status`: `offline` (will become `online` after login)

---

## 3. Run the application

You need **two processes** for hardware; **three** if you run automated checks.

### Terminal 1 — Next.js

```bash
npm run dev
```

App: http://localhost:3000

### Terminal 2 — TCP proxy (cabinet connections)

**PowerShell:**

```powershell
$env:STATION_PROXY_TOKEN="your-secret-token"
$env:API_AUTH_TOKEN="your-secret-token"
$env:API_BASE_URL="http://localhost:3000"
npm run tcp-proxy
```

**bash:**

```bash
export STATION_PROXY_TOKEN=your-secret-token
export API_AUTH_TOKEN=your-secret-token
export API_BASE_URL=http://localhost:3000
npm run tcp-proxy
```

- Cabinets connect on **TCP port 8088** (`TCP_PORT`)
- Proxy health/metrics HTTP on **port 8089** (`TCP_PROXY_URL`)

### Terminal 3 — Automated checks (optional)

```bash
npm run test:wscharge
npm run build
```

---

## 4. Smoke tests (no cabinet required)

| Check | How | Expected |
|-------|-----|----------|
| App loads | Open http://localhost:3000 | Pages render |
| API health | `GET http://localhost:3000/api/health` | `wscharge` section, DB not unhealthy |
| Proxy health | `GET http://localhost:8089/health` | `protocol: WsCharge v5.8P`, `status: healthy` |
| Admin hardware | Login → `/admin/hardware` | Page loads; stations list (may be empty) |
| Protocol tests | `npm run test:wscharge` | 13/13 pass |

### Example health check (browser or curl)

```
http://localhost:3000/api/health
http://localhost:8089/health
```

### Interpreting `/api/health`

| Field | Your typical local case |
|-------|-------------------------|
| `components.database` **healthy** | Supabase is wired correctly |
| `components.tcp-proxy` **unhealthy** + `fetch failed` | `TCP_PROXY_URL` is set but `npm run tcp-proxy` is **not running** (or wrong port) |
| `components.payment-service` **degraded** | Stripe keys missing — OK for non-payment tests |
| `wscharge.connectedStations: 0` **degraded** | Normal until a cabinet connects through the proxy |

**Overall `unhealthy`** almost always means the TCP proxy check failed while `TCP_PROXY_URL` is set (e.g. `http://localhost:8089`).

**Fix (hardware testing):** start the proxy in a second terminal (see §3). Then `http://localhost:8089/health` should return `"status":"healthy"`.

**Fix (UI-only dev, no cabinet):** remove or comment out `TCP_PROXY_URL` in `.env.local` and restart `npm run dev`. The health endpoint will report tcp-proxy as “Not configured” and skip the fetch.

After the proxy is running, overall status is usually **`degraded`** until Stripe is configured and/or a cabinet is online — that is expected in local dev.

---

## 5. Testing with a physical cabinet

**Full guide:** [TESTING_REAL_STATION.md](./TESTING_REAL_STATION.md)

1. Configure the cabinet to connect to your machine’s **LAN IP** on port **8088** (not 3000).
2. Ensure `STATION_PROXY_TOKEN` and `API_AUTH_TOKEN` match in `.env.local` and the proxy terminal.
3. After power-on, the cabinet sends login (`0x60`). The proxy forwards frames to `/api/stations/message`.
4. In **Admin → Hardware**, the station should show **online** and heartbeats should update.
5. Use **Refresh inventory** on a station to send `0x64` and update slots in the database.
6. For rentals: complete Stripe checkout (if configured), then confirm borrow (`0x65`) moves the session from `pending` to `active` when the cabinet responds.

### Troubleshooting

| Symptom | Likely cause | Action |
|---------|----------------|--------|
| 401 on `/api/stations/message` | Token mismatch | Align `STATION_PROXY_TOKEN`, `API_AUTH_TOKEN`, and proxy env |
| Station always offline | Proxy not running or wrong SN | Start `npm run tcp-proxy`; check `external_id` in DB |
| Borrow stays pending | No TCP path / command failed | Check proxy logs; verify `TCP_PROXY_URL` in Next.js env |
| Admin 401 | Not logged in as admin | Use `/admin/login` |

More detail: [docs/wscharge/RUNBOOK.md](./wscharge/RUNBOOK.md)

---

## 6. What “working” means by layer

| Layer | Works when |
|-------|------------|
| Database | Migrations applied; tables visible in Supabase |
| PWA | UI loads; `/api/stations` returns real data (not mock) |
| WsCharge ingress | Proxy running + tokens set + cabinet connected (or authenticated manual POST to message API) |
| Outbound commands | `TCP_PROXY_URL` set + cabinet online + admin/rental unlock commands |
| Billing | Stripe configured + webhook for production-like rental flow |

---

## 7. Related documentation

- [PWA rental flow](./PWA_RENTAL_FLOW.md)
- [Testing a real station](./TESTING_REAL_STATION.md)
- [WsCharge overview](./wscharge/README.md)
- [Implementation map](./wscharge/IMPLEMENTATION_MAP.md)
- [Operations runbook](./wscharge/RUNBOOK.md)
- [Environment variables](../.env.example)

---

## 8. Quick checklist

- [ ] `.env.local` filled (Supabase + matching proxy tokens)
- [ ] `npm install`
- [ ] Migrations `002`, `003`, `004` applied in Supabase
- [ ] At least one row in `stations` with matching `external_id`
- [ ] `npm run dev` running
- [ ] `npm run tcp-proxy` running
- [ ] `http://localhost:3000/api/health` returns healthy/degraded (not unhealthy)
- [ ] `http://localhost:8089/health` responds
- [ ] Admin → Hardware page loads
- [ ] (Optional) Cabinet connected and shows online
- [ ] (Optional) `npm run test:wscharge` passes
