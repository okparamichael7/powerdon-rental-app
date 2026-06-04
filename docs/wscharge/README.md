# WsCharge Integration

PowerDon uses **WsCharge Communication Protocol v5.8P** over TCP for cabinet connectivity.

## Quick start

1. Copy env vars from `.env.example` (WsCharge section).
2. Apply migration `003_wscharge_hardware_idempotency.sql`.
3. Run Next.js and the TCP proxy (`npm run tcp-proxy`).
4. Point cabinets to `TCP_HOST:TCP_PORT`.

## Documentation

- [Implementation map](./IMPLEMENTATION_MAP.md)
- [Operations runbook](./RUNBOOK.md)

## Tests

```bash
npm run test:wscharge
```

## Code layout

| Path | Role |
|------|------|
| `lib/wscharge/protocol.ts` | Binary codec |
| `lib/wscharge/protocol-handler.ts` | Business + DB processing |
| `lib/wscharge/station-manager.ts` | In-memory connection state |
| `server/tcp-proxy.ts` | TCP → HTTP bridge |
| `app/api/stations/message/route.ts` | HTTP ingress |
