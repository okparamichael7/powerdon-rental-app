# WsCharge Implementation Map (v5.8P)

**Source of truth:** `WsCharge Communication Protocol.md` (Shenzhen Worthy Network Technology Co., July 2024).

**Secondary doc:** `沃试通信板视频机对接协议V2.1` — UART bridge between function board and 4G module (`CREATE` / `send` / `rece` / `reply` / `ctrl`). Not used by the Next.js TCP path; cabinets terminate TCP with the server/proxy.

## Protocol version

| Item | Value |
|------|--------|
| Version | **5.8P** |
| Transport | **TCP** (cabinet → server) |
| Frame | `PacketLen` (uint16 BE) + `Command` + `VSN` (0x01) + `CheckSum` (XOR payload) + `Token` (0x11223344) + `Payload` |
| Heartbeat | Cabinet every **30s** after login; **4** missed → cabinet reconnects |
| Server stale | App marks offline after **120s** without heartbeat (configurable) |

## Commands implemented

| Code | Name | Direction | Handler |
|------|------|-----------|---------|
| 0x60 | Login | Cabinet → Server | `protocol-handler` + login response |
| 0x61 | Heartbeat | Bidirectional | Heartbeat ack |
| 0x62 | Query version | Server → Cabinet | `station-manager.sendCommand` |
| 0x63 | Set server address | Server → Cabinet | `buildSetServerAddress` |
| 0x64 | Inventory | Server → Cabinet / response | DB inventory sync |
| 0x65 | Borrow | Server → Cabinet / response | Rental session start |
| 0x66 | Return | Cabinet → Server | Return ack + session complete |
| 0x67 | Remote reboot | Server → Cabinet | Admin command |
| 0x68 | Remote upgrade (FTP) | Server → Cabinet | `buildRemoteUpgradeCommand` |
| 0x69 | ICCID | Server → Cabinet / response | Station metadata |
| 0x6A | Query server address | Server → Cabinet / response | Parsed + logged |
| 0x71 | Network (CSQ) | Server → Cabinet / response | Signal strength |
| 0x80 | Force / full eject | Server → Cabinet / response | Admin + logging |
| 0x81 | Stacked eject | Server → Cabinet / response | Parsed |
| 0x82 | Stacked card count | Server → Cabinet / response | Parsed |

## Architecture

```
Cabinet ──TCP──► tcp-proxy.ts ──HTTP──► POST /api/stations/message
                                              │
                                              ▼
                                    lib/wscharge/protocol-handler.ts
                                              │
                         ┌────────────────────┼────────────────────┐
                         ▼                    ▼                    ▼
                 station-manager      station-repository    session-repository
```

## Security

- `STATION_PROXY_TOKEN` / `TCP_PROXY_API_KEY` on message and disconnect routes (service auth).
- Fixed protocol token validated on every frame.
- No credentials in logs; raw frames stored as BYTEA/hex in `hardware_events`.

## Idempotency

Inbound events use `idempotency_key` (SHA-256 of external ID + event type + frame hex). Duplicate inserts are ignored.

## Environment

See `.env.example` section **WsCharge / TCP proxy**.

## Known limitations

- Outbound commands require an active TCP session via `tcp-proxy` (in-memory `station-manager` for HTTP-only dev).
- RLS policies for `hardware_events` must be applied in Supabase dashboard if not in migrations.
- UART V2.1 bridge is documented but not implemented in this app layer.
