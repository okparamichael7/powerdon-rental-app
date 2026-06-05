# Powerdon Test Suite — Coverage Report

Generated as part of the enterprise test suite implementation.

## Tests added

### Unit tests (`tests/unit/` + existing `lib/**/*.test.ts`)

| Area | Files | Tests cover |
|------|-------|-------------|
| Stripe billing | `stripe/calculate-rental-charge.test.ts` | Ladder pricing, daily cap, currency, PI status mapping |
| Payment rules | `payment/payment-outcomes.test.ts`, `payment/webhook-fixtures.test.ts` | Capture/cancel decisions, webhook fixtures |
| Rental lifecycle | `rental/lifecycle.test.ts`, `rental/charge-estimate.test.ts` | State transitions, double-booking rules, charge parity |
| Security | `security/*.test.ts` | Validation, XSS sanitize, RBAC, API keys, idempotency, rate limits |
| Production | `env/production-check.test.ts` | Env readiness checks |
| WsCharge (existing) | `lib/wscharge/*.test.ts` | Protocol encode/decode, validation |
| PWA (existing) | `lib/pwa/*.test.ts` | Pricing display, charge estimates |
| Admin (existing) | `lib/admin/date-range.test.ts`, `lib/db/schema-compat.test.ts` | Date ranges, schema fallbacks |
| Session access (existing) | `lib/security/session-access.test.ts` | Unlock tokens, UUID IDOR |

### Integration tests (`tests/integration/` + `server/tests/`)

| Area | Files | Tests cover |
|------|-------|-------------|
| Auth & validation | `api/auth-and-validation.test.ts` | Admin 401, rental validation, support tickets, cron/internal gates |
| Security regression | `security/regression.test.ts` | IDOR, injection payloads, webhook signature, proxy token |
| Smoke | `smoke/health.test.ts` | Health, stations, auth endpoints |
| Hardware API (existing) | `server/tests/api.test.ts` | Stations, rentals, messages |

### E2E tests (`tests/e2e/`)

| File | Tests cover |
|------|-------------|
| `customer-rental.spec.ts` | PWA homepage, legal pages, rental UI smoke |
| `admin-dashboard.spec.ts` | Login gate, sessions/staff/audit RBAC pages |
| `smoke.spec.ts` | Health + stations API, manifest |

## Areas covered vs. requested scope

| Scope area | Coverage | Notes |
|------------|----------|-------|
| Customer rental flow | **Partial** | Validation + API + PWA smoke; no full Stripe checkout E2E |
| Admin dashboard | **Partial** | Auth gates + RBAC unit tests; no logged-in admin E2E |
| API & backend | **Good** | Validation, auth, rate limit, idempotency, error handling |
| Security | **Good** | IDOR, XSS, injection, webhook sig, API key, RBAC |
| Payments | **Good (unit)** | Billing math, outcomes, webhook fixtures; no live Stripe |
| Rental lifecycle | **Good (unit)** | State machine rules documented and tested |
| Component tests | **Minimal** | Existing PWA pricing tests; no RTL component suite |
| Production readiness | **Good** | Env checks + health smoke |

## Remaining gaps

| Gap | Risk | Recommended next step |
|-----|------|----------------------|
| Full Stripe checkout E2E | High | Stripe test mode + Playwright with test card |
| Logged-in admin CRUD E2E | Medium | Supabase test user + storage state in Playwright |
| `session-repository` DB integration | High | Supabase local stack or test project + teardown |
| Webhook handler with real DB | High | Insert test session, send signed Stripe CLI events |
| Hardware borrow/return E2E | Medium | Simulator + TCP proxy in CI service container |
| React component tests (RTL) | Low | Add Vitest + Testing Library for admin tables |
| Load/soak tests | Low | k6 or Artillery on `/api/rentals/start` |
| Visual regression | Low | Playwright screenshots for PWA/admin |

## Risk level

| Category | Level | Rationale |
|----------|-------|-----------|
| Billing math | **Low** | Comprehensive unit tests on ladder model |
| Auth / RBAC | **Low–Medium** | Unit + integration; admin session E2E incomplete |
| Payment webhooks | **Medium** | Signature tested; handler DB effects untested |
| Rental state machine | **Medium** | Rules tested; repository transitions need DB tests |
| Hardware path | **Medium** | Protocol unit tests; full path needs simulator CI |
| Customer UX | **Medium** | Smoke only; no payment completion E2E |

**Overall launch readiness: Medium–Low risk** for billing/security validation paths; **Medium risk** for end-to-end payment + hardware integration until Stripe/DB E2E tests are added.

## Recommended next tests (priority order)

1. **Signed Stripe webhook integration** — create pending session in test DB, fire `amount_capturable_updated`, assert `authorized` + borrow dispatch mock
2. **Session repository transition tests** — against Supabase branch with rollback
3. **Playwright admin login** — bootstrap admin email, verify sessions CRUD
4. **Playwright rental happy path** — mock station with available slot, checkout test card
5. **Double-booking concurrency** — parallel `POST /api/rentals/start` against one slot
6. **Cron maintenance** — seed expired pending sessions, call cron with secret, assert `expired`

## Verification (post-audit 2026-06-05)

```
npm run test:unit        → 142 pass, 0 fail
npm run test:integration → 59 tests (skip without server), 0 fail
```

See **`tests/AUDIT.md`** for the full enterprise verification audit with per-finding status.

## Production modules added (test-backed)

| Module | Purpose |
|--------|---------|
| `lib/rental/session-transitions.ts` | Rental/payment state machine rules |
| `lib/stripe/webhook-state-mappers.ts` | Stripe webhook → DB update mapping (used by route) |
| `lib/admin/status-config.ts` | Status badge labels (used by `StatusBadge`) |
