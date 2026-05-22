# PowerDon Environment Variables

This document describes all environment variables required for production deployment.

## Required Variables

### Database (Supabase)
```bash
# Supabase connection
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Auth redirect (v0 development only)
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=https://your-preview-url/auth/callback
```

### Authentication & Security
```bash
# API keys for internal services
TCP_PROXY_API_KEY=tcp_proxy_secret_key_here
ADMIN_API_KEY=admin_api_key_here
INTERNAL_API_KEY=internal_service_key_here

# Rate limiting (optional - uses defaults if not set)
# RATE_LIMIT_WINDOW_MS=60000
# RATE_LIMIT_MAX_REQUESTS=100

# IP allowlist for internal endpoints (comma-separated, use * for all)
# ALLOWED_IPS=10.0.0.0/8,172.16.0.0/12
```

### TCP Proxy Server
```bash
# TCP proxy connection (deployed separately)
TCP_PROXY_URL=https://tcp-proxy.your-domain.com

# TCP proxy server configuration (for the proxy itself)
TCP_SERVER_PORT=8765
TCP_SERVER_HOST=0.0.0.0
API_BASE_URL=https://your-app.vercel.app
WS_RECONNECT_INTERVAL=5000
```

### Payments (Stripe)
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Alerting (Optional)
```bash
# Slack notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Generic webhook
ALERT_WEBHOOK_URL=https://your-alert-endpoint.com/webhook

# PagerDuty (critical alerts)
PAGERDUTY_ROUTING_KEY=your-routing-key
```

### Metrics & Monitoring (Optional)
```bash
# Metrics API authentication
METRICS_API_KEY=metrics_read_key_here

# Logging level (debug, info, warn, error)
LOG_LEVEL=info

# Application identification
SERVICE_NAME=powerdon-api
APP_VERSION=1.0.0
```

## Environment-Specific Settings

### Development
```bash
NODE_ENV=development
LOG_LEVEL=debug
```

### Staging
```bash
NODE_ENV=production
LOG_LEVEL=info
NEXT_PUBLIC_SUPABASE_URL=https://staging-project.supabase.co
```

### Production
```bash
NODE_ENV=production
LOG_LEVEL=warn
# All alerting should be configured
# All API keys should be production keys
```

## TCP Proxy Deployment

The TCP proxy server runs separately from the Next.js app. Deploy using Docker:

```bash
# Build
cd server
docker build -t powerdon-tcp-proxy .

# Run
docker run -d \
  -p 8765:8765 \
  -e API_BASE_URL=https://your-app.vercel.app \
  -e API_KEY=tcp_proxy_secret_key_here \
  -e TCP_SERVER_PORT=8765 \
  powerdon-tcp-proxy
```

Or use docker-compose:
```bash
cd server
docker-compose up -d
```

## Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Add all required environment variables in the Vercel dashboard
3. Deploy

The Next.js app will be deployed to Vercel automatically on push.

## Health Checks

- **Liveness**: `GET /api/health?type=live`
- **Readiness**: `GET /api/health?type=ready`
- **Full status**: `GET /api/health`
- **Metrics**: `GET /api/metrics` (requires `METRICS_API_KEY`)
