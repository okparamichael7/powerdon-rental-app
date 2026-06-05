# Testing Against a Real WsCharge Station

Use this guide to connect a physical charging cabinet to your local (or deployed) Powerdon stack and verify the WsCharge v5.8P integration end-to-end.

**Related docs:** [LOCAL_SETUP_AND_TESTING.md](./LOCAL_SETUP_AND_TESTING.md), [wscharge/RUNBOOK.md](./wscharge/RUNBOOK.md)

---

## Architecture (one line)

Cabinet → **TCP :8088** (your PC or server) → **tcp-proxy** → **Next.js** `/api/stations/message` → Supabase + admin UI.

The cabinet never talks to port 3000 directly.

---

## 1. Before the cabinet connects

### Run both services

**Terminal 1 — Next.js**

```bash
npm run dev
```

**Terminal 2 — TCP proxy** (use the same token as in `.env` for all proxy auth vars)

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

You should see the TCP proxy listening on port **8088** and HTTP health on **8089**.

### Align tokens in `.env`

These must match between Next.js and the proxy process:

| Variable | Role |
|----------|------|
| `STATION_PROXY_TOKEN` | Next.js validates proxy → `/api/stations/message` |
| `API_AUTH_TOKEN` | tcp-proxy sends this header first |
| `TCP_PROXY_API_KEY` | Optional fallback — use same value if set |

Recommended: one secret in all three, or only set `STATION_PROXY_TOKEN` and export it when starting the proxy.

### Network

The cabinet must reach **your computer’s LAN IP**, not `localhost`.

1. Find your PC IP (PowerShell): `ipconfig` → IPv4 on Wi‑Fi/Ethernet (e.g. `192.168.1.42`).
2. Cabinet server settings: **IP = that address**, **port = 8088** (`TCP_PORT` in `.env`).
3. Allow **inbound TCP 8088** in Windows Firewall (Private network).
4. Phone/laptop and cabinet should be on the same network (or use router port forwarding if remote).

If the cabinet was previously aimed at a vendor cloud IP, change it to your PC (vendor panel, SMS, or command `0x63` set-server-address — see [wscharge/RUNBOOK.md](./wscharge/RUNBOOK.md)).

### Optional: pre-register in Supabase

Not required — on **login (`0x60`)** the app can **auto-create** a station from the cabinet serial (`ProductSn` → `stations.external_id`).

You can still add a row early in **Table Editor → `stations`**:

- `external_id` = exact cabinet serial (must match login packet)
- `is_enabled` = `true`
- `name` = anything

If `external_id` does not match the real serial, login still works but matching rentals/admin by SN is harder.

---

## 2. Connect the cabinet

1. Power the cabinet / ensure cellular or network link is up.
2. Watch the **tcp-proxy terminal** — you should see a new TCP connection and, after login, frame activity.
3. Check proxy health:

   ```
   http://localhost:8089/health
   ```

   `stations` / `connections` should be ≥ 1.

4. Check app health:

   ```
   http://localhost:3000/api/health
   ```

   `wscharge.connectedStations` should become **≥ 1**. Overall status may stay **`degraded`** if Stripe is not configured — that is OK for hardware-only tests.

---

## 3. Verify in the app (operator)

1. Log in as admin → **`/admin/hardware`**.
2. Station should show **online** with a recent heartbeat.
3. Open station **Details** → **Recent protocol events** (when event logging is enabled).
4. Click **Refresh inventory** → sends `0x64`; slots should update in the database and UI.
5. In Supabase → **`hardware_events`** — rows for `login`, `heartbeat`, `inventory`.

Get station UUID from admin or:

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
| Query info (signal, etc.) | Admin → station actions | network / ICCID queries |
| Force eject one slot | Admin (confirm dialog) | `0x80` — **physical eject** |
| Reboot station | Admin | `0x67` — cabinet goes offline briefly |

Watch the **tcp-proxy** log and `hardware_events` for errors.

---

## 5. Test a rental (needs Stripe)

Full user flow:

1. Configure Stripe test keys in `.env`, restart `npm run dev`.
2. PWA: pick station → start rental / pay deposit.
3. App sends **borrow (`0x65`)** via proxy when the station is online.
4. Cabinet unlocks a slot; response should move the session **`pending` → `active`**.
5. Return the power bank physically → cabinet sends **return (`0x66`)** → session completes.

Without Stripe you can still test **hardware only** (login, heartbeat, inventory, admin commands), not the full checkout path.

---

## 6. Troubleshooting real hardware

| Symptom | What to check |
|---------|----------------|
| Nothing in proxy log | Wrong IP/port on cabinet; firewall; not on same network |
| Proxy connects, no login | Token 401 — unify `STATION_PROXY_TOKEN` / `API_AUTH_TOKEN` |
| Login in events, offline in UI | Refresh admin; check `stations.last_heartbeat` in DB |
| `connectedStations: 0` but proxy shows connection | Restart `npm run dev` after first login; or login failed (checksum/token) |
| Borrow stays pending | Station not online in app; proxy down; slot empty |
| Login result 0 | Vendor rejection or DB error — check `parsed_data` in `hardware_events` |

Proxy logs + Supabase `hardware_events` are the main debug trail.

---

## 7. If the cabinet cannot reach your PC

Use a **public server** instead:

1. Deploy Next.js and run tcp-proxy on a VPS (same `.env`, open **8088** and your app port).
2. Point the cabinet to **VPS public IP:8088**.
3. Or use a tunnel (e.g. ngrok) to expose 8088 — less stable, OK for a quick test.

Local dev only works when the cabinet can open TCP to your machine.

---

## Minimal success checklist

- [ ] `npm run dev` + `npm run tcp-proxy` running
- [ ] Cabinet configured to **PC LAN IP:8088**
- [ ] `http://localhost:8089/health` shows connections
- [ ] `/admin/hardware` shows station **online**
- [ ] Refresh inventory updates slots
- [ ] `hardware_events` has `login` / `heartbeat` rows

That confirms the real station path end-to-end. Stripe and a full rental are the next layer on top.

**PWA rental details:** [PWA_RENTAL_FLOW.md](./PWA_RENTAL_FLOW.md)

---

## Key environment variables

| Variable | Typical local value |
|----------|---------------------|
| `STATION_PROXY_TOKEN` | Same as `API_AUTH_TOKEN` |
| `TCP_PROXY_URL` | `http://localhost:8089` |
| `API_BASE_URL` | `http://localhost:3000` |
| `TCP_PORT` | `8088` (cabinet connects here) |
| `WS_PORT` / proxy HTTP | `8089` |
