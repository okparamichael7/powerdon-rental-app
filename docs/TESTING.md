# Powerdon Rental App — Testing Guide

This document describes how to run, extend, and troubleshoot the test suite.

## Quick start

```bash
# Unit tests only (no running server required)
npm run test:unit

# Integration tests (requires `npm run dev` or deployed TEST_API_URL)
npm run test:integration

# Full Node test suite (unit + integration)
npm run test:all

# End-to-end browser tests (Playwright)
npm run test:e2e

# CI-equivalent local run
npm run test:ci
```

## Test layout

| Directory | Purpose |
|-----------|---------|
| `tests/unit/` | Pure logic, validation, billing math, RBAC rules |
| `tests/integration/` | HTTP API tests against a live server |
| `tests/e2e/` | Playwright browser tests (PWA + admin) |
| `tests/fixtures/` | Factories and Stripe webhook fixtures |
| `tests/helpers/` | API client, env helpers |
| `lib/**/*.test.ts` | Legacy co-located unit tests (wscharge, security, pwa) |
| `server/tests/` | Hardware/API integration tests |

## Environment variables

### Unit tests

No environment required. Tests use in-memory rate limiting and pure functions.

### Integration tests

| Variable | Default | Purpose |
|----------|---------|---------|
| `TEST_API_URL` | `http://localhost:3000` | Target server |
| `SKIP_INTEGRATION_TESTS` | — | Set to `1` to skip integration suites |
| `ADMIN_API_KEY` | — | Enables authenticated admin API tests |
| `STATION_PROXY_TOKEN` | — | Enables hardware auth regression tests |

Start the dev server before integration tests:

```bash
npm run dev
# separate terminal
npm run test:integration
```

### E2E tests (Playwright)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PLAYWRIGHT_BASE_URL` | `http://localhost:3000` | App URL |
| `PLAYWRIGHT_SKIP_WEBSERVER` | — | Set to `1` if server already running |
| `NEXT_PUBLIC_USE_MOCK_DATA` | `true` in e2e | PWA mock mode |
| `NEXT_PUBLIC_ADMIN_USE_MOCK_DATA` | `true` in e2e | Admin mock mode |

Install browsers once:

```bash
npx playwright install chromium
```

## CI

GitHub Actions workflow `.github/workflows/test.yml` runs:

1. **Unit tests** — always, no secrets
2. **Integration tests** — skipped gracefully if server unavailable
3. **E2E smoke** — builds app, runs Playwright with mock data

## Writing new tests

### Unit test pattern

```typescript
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { myFunction } from '@/lib/my-module'

describe('myFunction', () => {
  it('does the expected thing', () => {
    assert.equal(myFunction(1), 2)
  })
})
```

Place files under `tests/unit/` with `.test.ts` suffix.

### Integration test pattern

Use `tests/helpers/api-client.ts` and skip when server is unreachable:

```typescript
import { before } from 'node:test'
import { isServerReachable, apiRequest } from '../../helpers/api-client'

let serverUp = false
before(async () => { serverUp = await isServerReachable() })

it('example', async (t) => {
  if (!serverUp) return t.skip('Server not reachable')
  const { status } = await apiRequest('/api/health')
  assert.equal(status, 200)
})
```

### Factories

Use `tests/fixtures/factories.ts` for rental sessions, support tickets, and admin payloads.
Use `tests/fixtures/stripe-events.ts` for webhook event shapes.

## Coverage map

See `tests/REPORT.md` for the full coverage report, gaps, and risk assessment.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Integration tests all skip | Start `npm run dev` or set `TEST_API_URL` |
| `@/` import errors | Ensure `tsx` runs from repo root |
| Playwright timeout | Increase `webServer.timeout` or run server manually |
| Rate limit flakes | Integration tests use unique keys; retry after 60s |
| Stripe webhook tests fail locally | Expected without Stripe CLI — unit fixtures cover event shapes |

## Stripe webhook local testing

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copy whsec_... to STRIPE_WEBHOOK_SECRET
```

## Production readiness check

```bash
curl http://localhost:3000/api/health | jq .productionReady
```

Or run `npm run test:integration -- tests/integration/smoke/`.
