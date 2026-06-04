# WsCharge Operations Runbook

## Health checks

1. **Next.js:** `GET /api/health` — includes database; configure `TCP_PROXY_URL` for proxy probe.
2. **TCP proxy:** `GET http://<proxy-host>:8089/health` — `connections`, `stations` counts.
3. **Metrics:** In-process counters via admin `GET /api/admin/hardware/events?stationId=<uuid>` (`metrics` field).

## Startup (local)

```bash
# Terminal 1 — Next.js
npm run dev

# Terminal 2 — TCP proxy
API_BASE_URL=http://localhost:3000 \
STATION_PROXY_TOKEN=<same as .env> \
TCP_PORT=8088 \
npx tsx server/tcp-proxy.ts
```

Point cabinets at `TCP_HOST:TCP_PORT`.

## Common failures

| Symptom | Likely cause | Action |
|---------|----------------|--------|
| 401 on `/api/stations/message` | Missing/wrong `STATION_PROXY_TOKEN` | Align proxy `API_AUTH_TOKEN` with app env |
| Login result 0 | SN not registered / DB error | Check `stations.external_id`, Supabase logs |
| Station shows offline | Heartbeat timeout | Verify 30s heartbeats; check `last_heartbeat` |
| Borrow pending forever | No TCP path to cabinet | Confirm proxy connection; check `station-manager` online |
| Duplicate session events | Retried frames | Expected — idempotency keys prevent duplicate rows |

## Rollback

1. Set `WSCHARGE_ENABLED=false` (disables strict production token check only — stop proxy to halt hardware).
2. Revert deployment; run down migration only if `003_wscharge_hardware_idempotency.sql` causes issues (columns are additive).
3. Cabinets cache server address — use vendor tool or `0x63` set-server-address if redirecting.

## Retention

`hardware_events` can grow quickly. Recommended: monthly partition or purge `created_at < now() - interval '90 days'` in a scheduled job.
