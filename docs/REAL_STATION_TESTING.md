# Testing Against a Real WsCharge Station

This guide walks through connecting a **physical WsCharge cabinet** to your local PowerDon stack (Next.js + TCP proxy + Supabase).

## Architecture

```
Cabinet → TCP :8088 (your machine) → tcp-proxy → Next.js /api/stations/message → Supabase + Admin UI
```

The cabinet never talks to port **3000** directly. All hardware traffic goes through the TCP proxy on **8088**.

---

## 1. Before the cabinet connects

### Run both services

**Terminal 1 — Next.js**

```bash
npm run dev
```

**Terminal 2 — TCP proxy** (use the **same secret** as in `.env` for all proxy-related vars)

**PowerShell:**

```powershell
$env:STATION_PROXY_TOKEN="your-unified-secret"
$env:API_AUTH_TOKEN="your-unified-secret"
$env:API_BASE_URL="http://localhost:3000"
npm run tcp-proxy
```

**bash:**

```bash
export STATION_PROXY_TOKEN=your-unified-secret
export API_AUTH_TOKEN=your-unified-secret
export API_BASE_URL=http://localhost:3000
npm run tcp-proxy
```

You should see the proxy listening on TCP **8088** and HTTP health on **8089**.

### Align environment variables

These must match between `.env` and the proxy terminal:

| Variable | Role |
|----------|------|
| `STATION_PROXY_TOKEN` | Next.js validates inbound frames from the proxy |
| `API_AUTH_TOKEN` | Proxy sends this when posting to Next.js |
| `TCP_PROXY_API_KEY` | Fallback if the above are unset — prefer one unified secret |
| `TCP_PROXY_URL` | Next.js health checks, e.g. `http://localhost:8089` |
| `API_BASE_URL` | Proxy target, e.g. `http://localhost:3000` |
| `TCP_PORT` | Cabinet TCP port (default **8088**) |

### Network setup

The cabinet must reach **your computer’s LAN IP**, not `localhost`.

1. Find your PC IP (PowerShell): `ipconfig` → IPv4 on Wi‑Fi/Ethernet (e.g. `192.168.1.42`).
2. Configure the cabinet server: **IP = that address**, **port = 8088**.
3. Allow **inbound TCP 8088** in Windows Firewall (Private network).
4. Phone/laptop and cabinet should be on the same network (or use router port forwarding for remote tests).

If the cabinet was previously pointed at a vendor cloud IP, reconfigure it to your PC (vendor panel, SMS, or protocol command `0x63` set-server-address). Cabinets cache server addresses.

### Optional: pre-register in Supabase

**Not required.** On login (`0x60`), the app can **auto-create** a station from the cabinet serial (`ProductSn` → `stations.external_id`).

You may still add a row early in **Table Editor → `stations`**:

- `external_id` = exact cabinet serial (must match the login packet)
- `is_enabled` = `true`
- `name` = any display name

If `external_id` does not match the real serial, login can still work but matching rentals and admin filters by SN is harder.

---

## 2. Connect the cabinet

1. Power the cabinet / ensure cellular or network is up.
2. Watch the **tcp-proxy terminal** — expect “New TCP connection” and traffic after login.
3. Check proxy health: `http://localhost:8089/health` — `stations` / `connections` should be ≥ 1.
4. Check app health: `http://localhost:3000/api/health` — `wscharge.connectedStations` should become **≥ 1**.

Overall status may stay **`degraded`** without Stripe or with zero stations briefly — that is normal until login completes.

---

## 3. Verify in the app (operator)

1. Log in as admin → **`/admin/hardware`**.
2. Station should show **online** with a recent heartbeat.
3. Open station **Details** → review recent protocol events.
4. Click **Refresh inventory** → sends `0x64`; slots should update in the DB and UI.
5. In Supabase → **`hardware_events`** — expect rows for `login`, `heartbeat`, `inventory`.

Example query:

```sql
SELECT id, external_id, status, last_heartbeat
FROM stations
ORDER BY last_heartbeat DESC;
```

---

## 4. Test commands (safe → careful)

| Action | Where | Protocol |
|--------|--------|----------|
| Refresh inventory | Admin → Hardware | `0x64` |
| Query info (signal, etc.) | Admin station actions | network / ICCID queries |
| Force eject one slot | Admin (confirm dialog) | `0x80` — **physically ejects** |
| Reboot station | Admin | `0x67` — cabinet goes offline briefly |

Watch the **tcp-proxy** log and `hardware_events` for errors.

---

## 5. Test a rental (requires Stripe)

Full user flow:

1. Configure Stripe test keys in `.env`, restart `npm run dev`.
2. PWA: pick station → start rental / pay deposit.
3. App sends **borrow (`0x65`)** via the proxy when the station is online.
4. Cabinet unlocks a slot; response should move the session **`pending` → `active`**.
5. Return the power bank physically → cabinet sends **return (`0x66`)** → session completes.

Without Stripe you can still test **hardware only** (login, heartbeat, inventory, admin commands), not the full checkout path.

---

## 6. Troubleshooting

| Symptom | What to check |
|---------|----------------|
| Nothing in proxy log | Wrong IP/port on cabinet; firewall; not on same network |
| Proxy connects, no login | Token 401 — unify `STATION_PROXY_TOKEN` / `API_AUTH_TOKEN` |
| Login in events, offline in UI | Refresh admin; check `stations.last_heartbeat` in DB |
| `connectedStations: 0` but proxy shows a connection | Restart `npm run dev` after first login; or login failed (token/checksum) |
| Borrow stays `pending` | Station not online in app; proxy down; target slot empty |
| Login rejected (result 0) | Vendor/time/sync issues — inspect `parsed_data` in `hardware_events` |

Primary debug trail: **tcp-proxy logs** + Supabase **`hardware_events`**.

---

## 7. When the cabinet cannot reach your PC

Use a **public host** instead:

1. Deploy Next.js and run `tcp-proxy` on a VPS (same env, open **8088** and your app port).
2. Point the cabinet to **VPS public IP:8088**.
3. For a quick test only: tunnel **8088** (e.g. ngrok) — less stable than a VPS.

Local dev only works when the cabinet can open TCP to your machine.

---

## Minimal success checklist

- [ ] `npm run dev` and `npm run tcp-proxy` running
- [ ] Cabinet configured to **PC LAN IP:8088**
- [ ] Proxy secrets match `.env`
- [ ] `http://localhost:8089/health` shows connections
- [ ] `/admin/hardware` shows station **online**
- [ ] Refresh inventory updates slots
- [ ] `hardware_events` has `login` / `heartbeat` rows

That confirms the real-station path end-to-end. Stripe and a full rental are the next layer.

---

## Related docs

- [LOCAL_SETUP_AND_TESTING.md](./LOCAL_SETUP_AND_TESTING.md) — general local setup and smoke tests
- [wscharge/RUNBOOK.md](./wscharge/RUNBOOK.md) — operations, failures, rollback
