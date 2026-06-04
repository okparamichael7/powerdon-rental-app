# PowerDon Rental App - Technical Handoff

## Overview

PowerDon is a power bank rental PWA that allows users to rent portable chargers from physical stations via QR code scanning. The system includes a consumer-facing mobile app and an admin dashboard for operations management.

**Production URL:** https://app.powerdon.nl  
**Vercel Project:** v0-power-bank-rental-app  
**Repository:** okparamichael7/powerdon-rental-app

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5.7 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Payments | Stripe (authorization/capture model) |
| Styling | Tailwind CSS 4 |
| UI Components | Radix UI + shadcn/ui |
| State Management | React Context + SWR |
| Deployment | Vercel |

---

## Architecture

```
├── app/                    # Next.js App Router
│   ├── page.tsx           # PWA entry point (consumer app)
│   ├── admin/             # Admin dashboard (protected)
│   ├── api/               # API routes
│   └── auth/              # Auth callback handlers
├── components/
│   ├── pages/             # PWA page components
│   ├── volt/              # Custom design system
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── services/          # Business logic (Supabase queries)
│   ├── supabase/          # Supabase client configuration
│   ├── stripe/            # Stripe payment service
│   ├── integrations/      # Hardware & external integrations
│   └── app-state.tsx      # PWA global state
└── supabase/
    └── migrations/        # Database schema
```

---

## User Flow

1. User scans QR code on physical station (native camera)
2. Opens `https://app.powerdon.nl?station=STATION_ID`
3. App loads station data, shows availability
4. User enters email/name, accepts terms
5. User authorizes €28 deposit via Stripe
6. System sends unlock command to hardware
7. User takes power bank
8. On return: user scans return station QR
9. System calculates charge, captures payment, releases deposit

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | Customer accounts (email, name, rental history) |
| `stations` | Physical charging stations (location, status, config) |
| `slots` | Individual slots within stations (battery level, status) |
| `power_banks` | Tracked power bank devices |
| `rental_sessions` | Active and completed rentals |
| `campaigns` | Pricing campaigns (rates, rewards, deposit amounts) |
| `rewards` | Loyalty rewards earned by users |
| `command_logs` | Hardware command audit trail |
| `station_events` | Station telemetry and events |

### Key Relationships

```
stations (1) ──< (N) slots
stations (1) ──< (N) rental_sessions
users (1) ──< (N) rental_sessions
campaigns (1) ──< (N) stations
rental_sessions (1) ──< (N) rewards
```

### Row Level Security (RLS)

All tables have RLS enabled:
- `service_role` has full access (for backend operations)
- Users can only read/update their own data
- Public tables (stations, slots, campaigns) allow anonymous reads

---

## API Routes

### Public Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/stations` | List all stations |
| GET | `/api/stations/[id]` | Get station details with slots |
| GET | `/api/health` | Health check |

### Protected Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/rentals/start` | Start a new rental |
| GET | `/api/rentals/[sessionId]` | Get rental status |
| POST | `/api/rentals/[sessionId]/cancel` | Cancel/end rental |
| POST | `/api/stations/[id]/unlock` | Trigger slot unlock |
| POST | `/api/stations/message` | Send command to station |

### Webhooks

| Route | Purpose |
|-------|---------|
| `/api/webhooks/stripe` | Stripe payment events |

---

## Services Layer

All business logic is in `lib/services/`:

| Service | Responsibility |
|---------|----------------|
| `station-service.ts` | Station CRUD, availability queries |
| `rental-service.ts` | Rental lifecycle (start, complete, cancel) |
| `user-service.ts` | User management, rental history |
| `reward-service.ts` | Reward issuance and redemption |
| `campaign-service.ts` | Campaign management |
| `analytics-service.ts` | Dashboard metrics |
| `support-service.ts` | Support tickets |
| `hardware-service.ts` | Station commands (unlock, inventory) |

---

## Payment Flow (Stripe)

### Authorization/Capture Model

1. **Authorization** - €28 deposit authorized (not captured)
2. **Rental Active** - Funds held on user's card
3. **Return** - Calculate actual charge based on duration
4. **Capture** - Capture only the rental amount
5. **Release** - Remaining authorization released automatically

### Pricing Structure

- First 5 minutes: Free
- After: €1 per 15 minutes
- Daily max: €27
- Deposit: €28 (configurable per campaign)

### Key Files

- `lib/stripe/index.ts` - Stripe client initialization
- `lib/stripe/payment-service.ts` - Payment intent operations
- `app/api/webhooks/stripe/route.ts` - Webhook handler

---

## Admin Dashboard

**URL:** `/admin` (requires authentication)

### Pages

| Route | Purpose |
|-------|---------|
| `/admin` | Dashboard overview |
| `/admin/sessions` | Active/recent rentals |
| `/admin/stations` | Station management |
| `/admin/campaigns` | Pricing campaigns |
| `/admin/rewards` | Loyalty program |
| `/admin/leads` | Marketing leads |
| `/admin/analytics` | Business metrics |
| `/admin/hardware` | Hardware monitoring |
| `/admin/ops` | Operations tools |
| `/admin/billing` | Revenue/billing |

### Authentication

- Supabase Auth (email/password)
- Protected by middleware (`middleware.ts`)
- Session managed via cookies

---

## Environment Variables

### Required

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Database (auto-generated by Supabase)
POSTGRES_URL=
POSTGRES_URL_NON_POOLING=
```

### Optional

```env
# Hardware Integration
STATION_TCP_HOST=
STATION_TCP_PORT=
```

---

## QR Code Format

Each physical station has a QR code that encodes:

```
https://app.powerdon.nl?station={DEVICE_ID}
```

Examples:
- `https://app.powerdon.nl?station=A12`
- `https://app.powerdon.nl?station=B05`

The `device_id` maps to the `stations.device_id` column.

---

## Test Stations

Pre-seeded test stations:

| Device ID | Location | Status |
|-----------|----------|--------|
| A12 | Amsterdam Centraal | Online |
| B05 | Schiphol Airport | Online |
| C01 | Rotterdam Blaak | Online |
| D03 | Utrecht Centraal | Online |
| E07 | Den Haag HS | Offline |

---

## Hardware Integration

### WsCharge Protocol

The system communicates with physical stations via TCP/WebSocket using the WsCharge protocol:

- **Commands:** `UNLOCK`, `LOCK`, `INVENTORY`, `STATUS`
- **Events:** `HEARTBEAT`, `BANK_INSERTED`, `BANK_REMOVED`, `ERROR`

### Mock Mode

When `STATION_TCP_HOST` is not configured, the system uses mock hardware responses for development.

---

## Deployment

### Vercel Configuration

- Framework: Next.js
- Build Command: `next build`
- Output Directory: `.next`
- Node Version: 20.x

### Domains

- Production: `app.powerdon.nl`
- Preview: `*.vercel.app`

### CI/CD

- Automatic deployments on push to `main`
- Preview deployments for PRs
- Branch: `v0/okpara-3751-f65410ed`

---

## Local Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Run database migrations
npx supabase db push

# Seed test data
npx tsx scripts/seed-stations.ts
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `lib/app-state.tsx` | PWA global state provider |
| `lib/types.ts` | TypeScript interfaces |
| `lib/session-store.ts` | Pricing calculations |
| `middleware.ts` | Auth protection |
| `components/app-shell.tsx` | PWA navigation shell |
| `supabase/migrations/001_initial_schema.sql` | Database schema |

---

## Known Limitations

1. **Hardware Integration** - TCP proxy not deployed; using mock responses
2. **Email Notifications** - Not configured; using console logging
3. **Push Notifications** - Not implemented
4. **Offline Mode** - Limited; requires network for payments

---

## Future Enhancements

- [ ] Native mobile apps (React Native)
- [ ] Push notifications for rental reminders
- [ ] Multi-language support (NL, EN, DE)
- [ ] Station map view
- [ ] Subscription plans
- [ ] Corporate accounts

---

## Support Contacts

- **Repository:** github.com/okparamichael7/powerdon-rental-app
- **Vercel Project:** v0-power-bank-rental-app

---

*Last updated: June 2026*
