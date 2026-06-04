# WsCharge Post-Implementation Verification Audit

## Round 1 (pre-remediation) — summary

| ID | Finding | Status R1 |
|----|---------|-----------|
| A1 | Protocol v5.8P documented | Fully Resolved |
| A2 | TCP transport (not UART) for app path | Fully Resolved |
| B1 | Protocol adapter layer | Fully Resolved |
| B2 | Zod/runtime validation on ingress | **Partially Resolved** |
| B3 | Idempotent event pipeline | **Partially Resolved** |
| C1 | TCP proxy correct framing | Fully Resolved (R1) |
| C2 | Outbound commands reach cabinet | **Still Open** |
| C3 | Exponential backoff on proxy→API | **Partially Resolved** |
| D1 | Core commands 0x60–0x66, 0x80 | Fully Resolved |
| D2 | Optional 0x62–0x69, 0x71, 0x81–0x82 | **Partially Resolved** |
| E1 | Service token auth on message route | Fully Resolved |
| F1 | DB persistence + migration 003 | **Partially Resolved** (types lag) |
| G1 | Rental/borrow/return business wiring | Fully Resolved |
| G2 | DB UUID vs product SN for commands | **Still Open** |
| H1 | Admin hardware page | **Partially Resolved** |
| H2 | Protocol events in admin UI | **Still Open** |
| I1 | Structured metrics | **Partially Resolved** |
| I2 | Health uses real DB/proxy checks | **Still Open** |
| J1 | Protocol unit tests (v5.8P) | Fully Resolved |
| J2 | Handler/integration/E2E tests | **Partially Resolved** |
| K1 | Env documented | Fully Resolved |
| K2 | Startup config validation wired | **Partially Resolved** |
| L1 | Ops docs/runbook | Fully Resolved |

## Round 2 (post-remediation) — final

| ID | Finding | Status R2 | Evidence |
|----|---------|-----------|----------|
| B2 | Zod validation | **Fully Resolved** | `lib/wscharge/validation.ts`, `message/route.ts`, `validation.test.ts` |
| B3 | Idempotency | **Fully Resolved** | `idempotency.ts`, migration 003, `logHardwareEventIdempotent` |
| C2 | Outbound command dispatch | **Fully Resolved** | `command-dispatch.ts`, `station-manager` dispatch, `tcp-proxy` `POST /command/:id` |
| C3 | API retry backoff | **Fully Resolved** | `server/tcp-proxy.ts` `apiPost` retries |
| D2 | Optional command parsers | **Fully Resolved** | `protocol.ts` parsers; admin `query_info` via manager |
| F1 | DB types for new columns | **Fully Resolved** | `lib/db/types.ts` `correlation_id`, `idempotency_key` |
| G2 | UUID→SN resolution | **Fully Resolved** | `stationManager.linkDbId`, `resolveConnectionKey` |
| H1 | Hardware inventory mapping | **Fully Resolved** | `stations/route.ts` `inventory` alias |
| H2 | Events panel | **Fully Resolved** | `admin/hardware/page.tsx` + `/api/admin/hardware/events` |
| I1 | Metrics on health/admin | **Fully Resolved** | `metrics.ts`, health + admin events API |
| I2 | Health endpoint | **Fully Resolved** | `app/api/health/route.ts` uses `getSystemHealth()` |
| J2 | API test uses v5.8P hex | **Fully Resolved** | `server/tests/api.test.ts` updated |
| K2 | Config validation | **Fully Resolved** | `validateWsChargeConfig()` in health response |
| — | `npm run build` | **Fully Resolved** | Passes |
| — | `npm run test:wscharge` | **Fully Resolved** | 13/13 pass |

### Deferred (acceptable)

| ID | Item | Reason |
|----|------|--------|
| UART V2.1 bridge | Not Actionable for this app | Separate embedded path; documented in IMPLEMENTATION_MAP |
| Live cabinet E2E in CI | Deferred | Requires hardware lab; manual QA checklist in prior report |
| OpenTelemetry tracing | Deferred | Structured logs + metrics sufficient for v1; not in spec minimum |
| Prometheus export of WsCharge counters | Deferred | In-process JSON via health/admin; global `/api/metrics` unchanged |
| `0x68` FTP upgrade E2E | Deferred | Builder exists; operator-trigger UI not required for launch |
| `proxy-protocol.ts` removal | Deferred | Deprecated, unused by tcp-proxy |

### Not Actionable

| ID | Item |
|----|------|
| N1 | Supabase RLS policies in dashboard (ops procedure, not app code) |
| N2 | Full responsive QA matrix |
