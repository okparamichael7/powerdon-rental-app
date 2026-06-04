# PWA Rental Flow

How renting a power bank from the Progressive Web App works, what must be running, and how it differs with or without Stripe.

**Related:** [TESTING_REAL_STATION.md](./TESTING_REAL_STATION.md), [LOCAL_SETUP_AND_TESTING.md](./LOCAL_SETUP_AND_TESTING.md)

---

## Can you rent from the PWA?

**Yes** — the PWA can start a real rental when the full stack is up. It is not automatic: you need a connected cabinet, synced inventory, the TCP proxy, and the correct station link.

---

## What the PWA does

The rent flow is **API-backed** unless `NEXT_PUBLIC_USE_MOCK_DATA=true`:

1. Open rent with a **station UUID** in the URL, e.g.  
   `http://localhost:3000/?station=<stations.id>`
2. Enter email and accept terms → payment step
3. **`POST /api/rentals/start`** creates a session, reserves a slot, and sends **borrow (`0x65`)** to the cabinet via the TCP proxy
4. When the cabinet responds, the session moves **`pending` → `active`** and the slot should eject
5. **Return** is driven by the cabinet (**`0x66`**), not by a button in the PWA

You do **not** enter the Product SN in the PWA. The URL uses the **Supabase station UUID** (`stations.id`). The server matches hardware using `stations.external_id` (Product SN from cabinet login) when sending borrow.

---

## Station IDs (do not mix them up)

| ID | Used for | In the PWA? |
|----|----------|-------------|
| **Station UUID** (`stations.id`) | Rent URL `?station=…`, APIs, sessions | **Yes** — this is what you put in the link or QR |
| **Product SN** / `external_id` | TCP proxy, borrow commands, login | **No** — sent by the cabinet; stored automatically |

---

## Requirements checklist

| Requirement | Why |
|-------------|-----|
| `npm run dev` + `npm run tcp-proxy` | Borrow is dispatched through the proxy |
| Cabinet on **your LAN IP:8088**, logged in | Station must be **`online`** in the database |
| `NEXT_PUBLIC_USE_MOCK_DATA` **not** `true` | Otherwise the PWA uses mock data |
| Supabase + migrations applied | Sessions, slots, stations |
| **Inventory in DB** | Admin **Refresh inventory** (or cabinet `0x64`) so slots are **`occupied`** with power banks — otherwise “No power banks available” |
| PWA opened with **`?station=<uuid>`** | Rent page loads station from `/api/stations/:id` |

---

## Stripe vs no Stripe

### No Stripe publishable key (typical local dev)

When **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is unset**:

- The PWA uses the **non-Stripe payment step** and calls **`/api/rentals/start` directly** (no card charge).
- That path **sends the hardware borrow command** — best path for hardware testing.

### Stripe enabled

When **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set**:

- Checkout collects payment via Stripe.
- Webhooks mark the session **authorized / pending**.
- **Borrow is not triggered the same way** as `/api/rentals/start` after checkout success; the PWA success handler loads the session but does not mirror the full unlock path.
- For **production paid rentals**, confirm unlock runs after payment or use the no-Stripe dev path for cabinet testing only.

If only `STRIPE_SECRET_KEY` is set without the publishable key, the rent page shows a **misconfiguration** message.

---

## Practical test flow (no Stripe)

1. Cabinet connected → station **online** in **Admin → Hardware**
2. **Refresh inventory** on that station
3. Copy **station UUID** from Supabase (`stations.id`) or admin
4. Open: `http://localhost:3000/?station=<uuid>`
5. Complete the rent flow → watch tcp-proxy logs; confirm slot ejects
6. Return the power bank physically → cabinet sends return (`0x66`) → session completes

---

## API behavior (reference)

**`POST /api/rentals/start`**

- Requires `stationId` (UUID) and `userEmail`
- Station must be `online`
- Picks best slot (`occupied` with highest battery) unless `slotNumber` is specified
- Sends `BORROW_POWERBANK` when `station.external_id` is set and proxy dispatch succeeds
- If the command is not sent, session stays **`pending`** until the station connects and responds

**Borrow response (`processBorrowResult`)**

- Matches pending session by station + slot
- On success: session → **`active`**, slot → empty
- On failure: session → **`failed`**

---

## Common errors

| Message / symptom | Likely cause |
|-------------------|--------------|
| Station not loaded / scan QR | Missing `?station=<uuid>` in URL |
| Station is not available | Station `offline` in DB — cabinet not connected |
| No power banks available | No `occupied` slots — run **Refresh inventory** |
| Waiting for station connection | Borrow not dispatched — proxy down or station not in memory |
| Unlocking forever | Borrow failed or no cabinet response — check proxy + `hardware_events` |
| Payment is not configured | `STRIPE_SECRET_KEY` without `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| You already have an active rental | Complete or cancel existing session first |

---

## Summary

| Question | Answer |
|----------|--------|
| Can the PWA rent a power bank? | **Yes**, when hardware, proxy, DB, inventory, and station URL are set up |
| Do I use Product SN in the PWA? | **No** — use **station UUID** in `?station=` |
| Best path for local hardware test? | No Stripe publishable key → direct `/api/rentals/start` |
| Is return handled in the PWA? | **No** — physical return + cabinet protocol completes the session |
