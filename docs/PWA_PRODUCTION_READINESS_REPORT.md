# Powerdon PWA — Production Readiness Report

**Date:** June 4, 2026  
**Verification:** `npm run test` **25/25** pass · `npm run build` pass

---

## 1. Executive Summary

The Powerdon PWA is a **single-page event rental app** (power bank stations) with four in-app tabs: Rent, Status, Rewards, and Support. This remediation pass removed production mock runtime, wired simulated customer flows to real APIs, aligned pricing display with the Stripe ladder model, and hardened the rental return and support journeys.

The PWA is **ready for real customers** when production env, Supabase migrations, Stripe, and hardware TCP proxy are operational. Residual gaps are documented in §11–12 (no service worker, no in-app QR scanner, rewards history is device-local).

---

## 2. Screens Audited

| Screen | Route / Tab | Data source | Status |
|--------|-------------|-------------|--------|
| Rent wizard | `/` tab Rent | `GET /api/stations/{id}`, `POST /api/rentals/start`, Stripe checkout | ✅ Production APIs |
| Status | tab Status | `GET /api/rentals/{id}` sync + return polling | ✅ Real polling |
| Rewards | tab Rewards | localStorage + `POST /api/rewards/{id}/redeem` | ✅ Redeem wired |
| Support | tab Support | `GET /api/rentals/{code}`, `POST /api/support/tickets` | ✅ Wired |
| Terms | `/terms` | Static | ✅ |
| Privacy | `/privacy` | Static | ✅ |
| Offline banner | App shell | `navigator.onLine` | ✅ |

**Not applicable (product model):** Product catalog, search, filters, auth/login, profile, extensions, damage reporting — this is QR → station → rental flow, not SKU catalog.

---

## 3. Mock Data Removed

| Before | After |
|--------|-------|
| `getPwaDataLayer()` switched to `mock-bridge` when `NEXT_PUBLIC_USE_MOCK_DATA=true` | **Always** `lib/data/pwa-api.ts` |
| `isMockDataEnabled()` returned env flag | Returns `false`; flag ignored at runtime |
| `app-state.tsx` seeded `mockStation`, skipped API sync | Always loads station from QR/storage + API |
| Status return: 4.5s fake progress | Polls `waitForSessionCompletion()` until hardware return |
| Support lookup: any `VR-*` = found | `GET /api/rentals/{sessionCode}` |
| Support contact: simulated delay | `POST /api/support/tickets` |
| Success screen: fake session code | Uses real `activeSession` from API |
| Deposit payment: fake Apple/Google Pay UI | Single deposit authorization via server start API |
| Hardcoded €1.00/15min in UI | `lib/pwa/pricing-display.ts` ladder labels |

`lib/mock-data.ts`, `lib/data/mock-bridge.ts`, and mock service classes remain in repo for **dev reference only** — not used in PWA runtime.

---

## 4. Real Data Connections Added

| Function | API / backend |
|----------|----------------|
| `loadStationFromApi` | `GET /api/stations/{id}?source=database` |
| `startRentalFromApi` | `POST /api/rentals/start` |
| `syncSessionFromApi` | `GET /api/rentals/{id}` + session token |
| `waitForSessionCompletion` | Poll `GET /api/rentals/{id}` until `completed` |
| `completeRentalFromApi` | `GET /api/rentals/{id}` (reward + final state) |
| `cancelRentalFromApi` | `POST /api/rentals/{id}/cancel` |
| `redeemRewardFromApi` | `POST /api/rewards/{id}/redeem` |
| `lookupSessionByCode` | `GET /api/rentals/{code}` (public view) |
| `submitSupportTicket` | `POST /api/support/tickets` |
| Stripe checkout | `startRentalCheckout` server action + unlock API |

---

## 5. Buttons & Actions Fixed

| Action | Location | Implementation |
|--------|----------|----------------|
| Start rental | Rent landing | → info → payment → start/checkout |
| Authorize deposit | Rent payment (no Stripe key) | `startRental()` → API |
| Stripe pay | Rent payment | Embedded checkout + unlock |
| View rental status | Success / errors | Navigate to Status tab |
| Return power bank | Status | Poll until hardware completes return |
| Refresh session | Status / Rewards | `syncActiveSession()` |
| Redeem reward | Rewards | `redeemReward()` → API |
| Session lookup | Support | Real API lookup by code |
| Contact support | Support | Creates DB ticket |
| Terms / Privacy | Rent info form | Links to `/terms`, `/privacy` |

**Removed / deferred:** In-app QR scanner (external camera → URL), fake wallet selectors, simulated support tickets.

---

## 6. UX Improvements

- Ladder pricing labels consistent across landing, info, and payment steps
- Real session code and slot on success screen
- Return flow explains physical insert + automatic detection
- Support shows lookup result status/duration
- Help header button hidden unless explicitly wired (no dead clicks)
- Manifest icons point to existing `/icon.svg`

---

## 7. Security Improvements

- Session token required for UUID rental lookups (existing `denyUuidLookupWithoutAuth`)
- Support tickets: Zod validation + honeypot + rate limit on API
- Reward redeem requires reward `code` (existing)
- Unlock requires `unlockToken` after Stripe (existing)
- No mock data bypass in production runtime

---

## 8. Performance Improvements

- 30s session sync interval (unchanged, appropriate for event PWA)
- Client-side minute tick for charge estimate between syncs
- No artificial mock delays in production path
- Single-page shell avoids route transition overhead

**Future:** Service worker caching, code-split tab panels if bundle grows.

---

## 9. PWA Improvements

| Item | Status |
|------|--------|
| `manifest.webmanifest` | ✅ `app/manifest.ts` |
| `display: standalone` | ✅ |
| Theme / background colors | ✅ |
| Icons | ✅ SVG (add PNG 192/512 for broader install support) |
| Apple web app meta | ✅ `app/layout.tsx` |
| Service worker | ❌ Not implemented |
| Offline queue | ❌ Banner only |

---

## 10. Testing Added

| Suite | Tests |
|-------|------:|
| `lib/pwa/pricing-display.test.ts` | 2 |
| Existing security/wscharge/admin | 21 |
| `lib/pwa/charge-estimate-client.test.ts` | 2 |
| **Total** | **25** |

**Recommended manual QA:** Full QR → rent → Stripe → unlock → active → physical return → reward → redeem → support ticket.

---

## 11. Remaining Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Return requires hardware TCP + station insert | High | Ops: proxy online; user instructions in Status |
| No service worker | Medium | Online-first; offline banner |
| Rewards list device-local only | Medium | Re-issued on completed rental; no cross-device history API |
| No in-app QR scanner | Low | Venue QR opens `/?station=` URL |
| PNG install icons missing | Low | Add `icon-192.png` for older Android |

---

## 12. Known Limitations

- Not a multi-product catalog app — station-scoped power bank rental only
- Deposit-only mode when Stripe publishable key unset (by design)
- `use-session-realtime.ts` WebSocket hook exists but is unused; polling used instead
- Cookie consent not implemented (deferred GTM/legal)

---

## 13. Launch Checklist

```bash
# Env (see docs/VERCEL_ENV.md)
# NEXT_PUBLIC_USE_MOCK_DATA — unset (ignored; PWA always production)
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — set for Stripe checkout
# STRIPE_SECRET_KEY, SUPABASE_*, CRON_SECRET

# Migrations 005–008 applied in Supabase
# TCP proxy running (docs/HETZNER_TCP_PROXY_SETUP.md)
# Cron: POST /api/cron/maintenance

npm run test && npm run build
```

---

## 14. Manual QA Checklist

- [ ] Scan station QR → station loads with real slots/rates
- [ ] Complete rent with Stripe → unlock → success shows real session code + slot
- [ ] Status tab shows live duration and charge estimate
- [ ] Insert power bank at station → return detected → receipt + reward
- [ ] Redeem reward with code at merch desk
- [ ] Support: lookup session by code
- [ ] Support: submit ticket → receive ticket number
- [ ] Terms/Privacy links open `/terms` and `/privacy`
- [ ] Offline banner appears when network disabled
- [ ] Install PWA to home screen (manifest + icons)

---

## Key files

- `lib/data/index.ts`, `lib/data/pwa-api.ts` — production data plane
- `lib/app-state.tsx` — session persistence + orchestration
- `components/pages/rent-page.tsx` — rental wizard
- `components/pages/status-page.tsx` — active rental + return polling
- `components/pages/support-page.tsx` — support + tickets
- `components/pages/rewards-page.tsx` — rewards + redeem
- `lib/pwa/pricing-display.ts` — client pricing labels
