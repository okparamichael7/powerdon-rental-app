# PowerDon Enterprise Readiness Report

**Date:** June 4, 2026  
**Scope:** Full-stack audit and remediation pass (PWA, Admin, API, Supabase, WsCharge, Stripe)  
**Build verification:** `npm run test` (16 tests) and `npm run build` succeeded after remediation.

---

## 1. Executive Summary

PowerDon is a Next.js 16 rental platform with a customer PWA, Supabase-backed data layer, Stripe payments, and WsCharge hardware integration via a TCP proxy. This pass treated the codebase as launch-critical: security gaps on public APIs were closed, payment finalization was wired to hardware returns, production headers and env validation were added, and operational hooks (cron, webhook idempotency, DB constraints) were introduced.

The platform is **substantially closer to production launch** but not every GTM item (legal pages, SMS, distributed rate limiting, full E2E suite) is complete. Operators can run the business through the admin dashboard without direct DB access for core flows.

---

## 2. Critical Issues Found (Pre-Remediation)

| Issue | Risk |
|-------|------|
| Unauthenticated `POST /api/stations/[id]` (borrow, force eject, reboot) | Remote hardware abuse |
| Unlock API ignored `unlockToken` | Unauthorized eject |
| Public session GET exposed email, payment, rewards | IDOR / PII leak |
| Public reward redeem by UUID | Fraud |
| `x-station-proxy: true` header bypass | Forged hardware ingress |
| TCP proxy `/command`, `/stations`, `/ws` unauthenticated | Infrastructure takeover |
| Stripe capture never called on hardware return | Revenue / reconciliation failure |
| Cancel pending rental did not release Stripe hold | Customer harm |
| `ADMIN_API_KEY` blocked at edge while documented | Broken automation |
| Service role on all repositories | Single bug = full DB access |

---

## 3. High-Risk Issues Found

- Dual rental start paths (Stripe checkout vs `/api/rentals/start`) without unified slot reservation.
- In-memory rate limits (ineffective multi-instance).
- Admin/operator roles in JWT `user_metadata` (privilege escalation if metadata writable).
- No unique DB constraint preventing duplicate active sessions per user (race).
- Stripe webhook retries without idempotency store.
- No scheduled expiry for pending sessions / rewards.
- Production email/SMS not wired to lifecycle events.
- `operator` role missing from RLS helpers (direct Supabase client gap).

---

## 4. Medium-Risk Issues Found

- Zod schemas in `lib/security/validation.ts` unused by most API routes.
- Open redirect on OAuth `next` param (fixed).
- Missing security headers / CSP (fixed).
- Admin login not API rate-limited.
- Public station inventory exposes slot-level detail.
- Pricing inconsistency (Stripe ladder vs campaign hourly in DB return path).
- Health endpoint exposes integration metrics (acceptable with rate limit).

---

## 5. Security Improvements Implemented

| Control | Implementation |
|---------|----------------|
| Session access control | `lib/security/session-access.ts` — unlock token or staff auth for PII/mutations |
| Hardware commands | `POST /api/stations/[id]` requires admin session |
| Unlock | Token + payment authorization check |
| Reward redeem | Requires matching `code` (staff bypass) |
| Hardware ingress | Removed `x-station-proxy` boolean bypass; Bearer token only |
| TCP proxy HTTP/WS | Bearer / `x-api-key` on `/command`, `/stations`, `/ws` |
| Security headers | HSTS, CSP, X-Frame-Options, etc. in `next.config.mjs` |
| OAuth redirect | `lib/security/redirect.ts` allowlist |
| Admin API keys | `proxy.ts` accepts `ADMIN_API_KEY` for `/api/admin` |
| Stripe webhooks | `stripe_webhook_events` dedup table + insert before handle |
| Client tokens | `lib/client/session-token.ts` — sessionStorage for PWA |

---

## 6. Performance Improvements Implemented

- Migration `005_enterprise_hardening.sql`: indexes on `payment_intent_id`, `rewards.code`, `support_tickets.ticket_number`.
- Unique partial index: one open session per user (`pending`/`active`).
- Protocol handler kept out of client bundle (`lib/wscharge/index.ts`).

**Still recommended:** Redis rate limits, cursor pagination on admin lists, image CDN.

---

## 7. Reliability Improvements Implemented

| Area | Change |
|------|--------|
| Return billing | Internal `POST /api/internal/sessions/[id]/finalize-return` + Stripe `completeRentalPayment` |
| Cancel billing | `cancelRentalPaymentHold` on pending cancel |
| Webhook idempotency | `stripe_webhook_events` table |
| Maintenance cron | `POST /api/cron/maintenance` (expire sessions/rewards) |
| DB concurrency | Unique index on open sessions per user |

---

## 8. Database Improvements Implemented

**Migration:** `supabase/migrations/005_enterprise_hardening.sql`

- `idx_sessions_one_open_per_user` (unique partial)
- `idx_sessions_payment_intent`
- `idx_rewards_code`, `idx_support_tickets_ticket_number`
- `stripe_webhook_events` with RLS for service role

**Apply before production:** `supabase db push` or run migration in Supabase SQL editor.

---

## 9. Admin Dashboard Improvements

- Admin API key works at edge for headless ops.
- Existing admin surfaces: sessions, stations, campaigns, billing, hardware, rewards, users, analytics, ops health.
- Settings page reflects mock mode flag.

**Remaining:** Enforce admin role at login (not only on navigation), audit log UI for staff actions, formal operator vs admin permissions in DB.

---

## 10. Production Readiness Assessment

| Area | Status |
|------|--------|
| Build / TypeScript | Pass |
| Unit tests | 16 passing (`npm test`) |
| Env validation | `/api/health` exposes `productionReady` + checks in prod |
| Secrets in repo | None found |
| Mock mode | Opt-in only (`NEXT_PUBLIC_USE_MOCK_DATA=true`) |
| Hardware | Requires `STATION_PROXY_TOKEN` / `TCP_PROXY_API_KEY` in prod |
| Email | Resend when `RESEND_API_KEY` set |
| Cron | Requires `CRON_SECRET` — schedule via Vercel Cron or external scheduler |

**Score:** ~75/100 — core paths hardened; needs distributed limits, E2E, and role model in DB.

---

## 11. Launch Readiness Assessment

| Requirement | Status |
|-------------|--------|
| Payment authorize → capture on return | Implemented (Stripe path) |
| Session/token security | Implemented |
| Admin operations | Functional |
| DB migration 005 | **Must apply** |
| Cron job scheduled | **Operator action** |
| Stripe live keys + webhook | **Operator action** |
| Supabase RLS + service role hygiene | Review metadata policies |

**Verdict:** Ready for controlled pilot launch after migration + env checklist + smoke tests on real station.

---

## 12. GTM Readiness Assessment

| Item | Status |
|------|--------|
| Privacy / Terms pages | Not in repo — add before marketing launch |
| Cookie consent | Assess EU traffic |
| SEO / metadata | Basic Next app — review `app/layout.tsx` |
| Analytics | `@vercel/analytics` present |
| SMS notifications | Not implemented |
| Support email automation | Resend optional |
| Error pages | Default Next |

**Verdict:** Product-ready for B2B/event pilot; marketing/legal GTM items still needed.

---

## 13. Remaining Risks

1. **Service role bypasses RLS** — all route-level auth must stay correct.
2. **In-memory rate limiting** — bypass under horizontal scale.
3. **JWT metadata admin flags** — move to `app_metadata` or `staff_roles` table.
4. **Dual start flows** — consolidate Stripe + slot reserve.
5. **Borrow/session matching** — first pending per slot can mis-attach under race.
6. **No SMS** — OTP / rental alerts missing.
7. **Limited automated E2E** — manual QA still required for launch.
8. **TCP proxy** — must be network-isolated; never expose :8089 publicly without auth.

---

## 14. Recommended Future Enhancements

1. Redis-backed rate limits + admin login throttling.
2. Unified `RentalOrchestrator` service (reserve → pay → unlock → return).
3. `staff_roles` table synced with Supabase Auth hooks.
4. Playwright E2E: checkout, unlock, return, admin refund.
5. Sentry/Datadog + alert rules on `lib/ops/alerting.ts`.
6. Legal pages + consent management.
7. Twilio/MessageBird for SMS.
8. Rich Resend templates per `EmailTemplates` enum.
9. Read replicas / connection pooling for Supabase at scale.
10. Documented disaster recovery runbook (backup restore drill).

---

## Deployment Checklist

```bash
# 1. Apply migration
supabase db push   # or run 005_enterprise_hardening.sql

# 2. Required production env (see .env.example)
# NEXT_PUBLIC_USE_MOCK_DATA=false
# ALLOW_INSECURE_HARDWARE_DEV=false
# STRIPE_*, SUPABASE_*, STATION_PROXY_TOKEN, CRON_SECRET, METRICS_API_KEY
# RESEND_API_KEY (optional), INTERNAL_API_KEY

# 3. Schedule cron (daily)
# POST https://<app>/api/cron/maintenance
# Authorization: Bearer <CRON_SECRET>

# 4. Verify
npm run test && npm run build
curl https://<app>/api/health
```

---

## Files Touched (Remediation Summary)

- Security: `lib/security/session-access.ts`, `proxy.ts`, `next.config.mjs`, `lib/api/route-helpers.ts`
- APIs: rentals, unlock, stations POST, rewards redeem, internal finalize, cron, health, webhooks
- Rental: `lib/rental/finalize-payment.ts`, `lib/wscharge/protocol-handler.ts`
- Client: `lib/client/session-token.ts`, `lib/data/pwa-api.ts`, Stripe checkout, rent/rewards pages
- Infra: `server/tcp-proxy.ts`, `supabase/migrations/005_enterprise_hardening.sql`
- Ops: `lib/env/production-check.ts`, `lib/integrations/production-providers.ts`
- Tests: `lib/security/session-access.test.ts`, `package.json` scripts
