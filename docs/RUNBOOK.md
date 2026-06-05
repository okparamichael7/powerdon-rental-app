# Powerdon Operations Runbook

## System Overview

Powerdon is a power bank rental system consisting of:
1. **Next.js Web App** - Customer-facing app and admin dashboard (Vercel)
2. **TCP Proxy Server** - Bridges station hardware to the API (Docker/VPS)
3. **Supabase** - Database and authentication
4. **Stripe** - Payment processing

## Incident Response

### Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| P1 - Critical | Service completely down | < 15 min | Database unreachable, all stations offline |
| P2 - High | Major feature broken | < 1 hour | Payments failing, can't start rentals |
| P3 - Medium | Degraded service | < 4 hours | Single station offline, slow performance |
| P4 - Low | Minor issue | < 24 hours | UI bug, non-critical feature broken |

### Initial Triage

1. Check system health: `GET /api/health`
2. Check ops dashboard: `/admin/ops`
3. Review recent alerts in Slack/PagerDuty
4. Check Vercel deployment status
5. Check Supabase dashboard for DB issues

## Common Issues

### 1. Station Not Connecting

**Symptoms:**
- Station shows as offline in admin
- No heartbeat received

**Investigation:**
```bash
# Check TCP proxy logs
docker logs Powerdon-tcp-proxy --tail 100

# Check station events in database
SELECT * FROM station_events 
WHERE station_id = 'xxx' 
ORDER BY created_at DESC 
LIMIT 20;
```

**Resolution:**
1. Verify station has network connectivity
2. Check TCP proxy is running and accessible
3. Verify station's configured server IP/port
4. Check for firewall rules blocking port 8765
5. Restart station if needed

### 2. Unlock Command Failing

**Symptoms:**
- User paid but power bank not dispensed
- Error in rental start

**Investigation:**
```bash
# Check command logs
SELECT * FROM command_logs 
WHERE station_id = 'xxx' 
AND command_type = 'borrow'
ORDER BY created_at DESC 
LIMIT 10;
```

**Resolution:**
1. Check station is online
2. Verify slot has available power bank
3. Check command_logs for error details
4. Try force eject from admin if slot is stuck
5. Refund customer if hardware fault

### 3. Database Connection Timeout

**Symptoms:**
- 500 errors on API calls
- Health check shows database unhealthy

**Investigation:**
1. Check Supabase dashboard for connection limits
2. Review recent queries for long-running ones

**Resolution:**
1. Check if Supabase project is paused (wake it)
2. Review connection pooling settings
3. Check for runaway queries and kill them
4. Scale up Supabase if hitting limits

### 4. High Error Rate

**Symptoms:**
- PagerDuty alert for high failure rate
- Metrics showing increased errors

**Investigation:**
```bash
# Check error breakdown
SELECT 
  error_message,
  COUNT(*) as count
FROM rental_sessions
WHERE status = 'failed'
AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY error_message
ORDER BY count DESC;
```

**Resolution:**
1. Identify most common error
2. Check if specific station or widespread
3. Check recent deployments for regression
4. Roll back if deployment caused issue

### 5. TCP Proxy Down

**Symptoms:**
- All stations show offline
- TCP proxy health check failing

**Investigation:**
```bash
# Check container status
docker ps -a | grep tcp-proxy

# Check logs
docker logs Powerdon-tcp-proxy --tail 200
```

**Resolution:**
```bash
# Restart container
docker restart Powerdon-tcp-proxy

# If persistent, recreate
docker-compose down
docker-compose up -d
```

## Maintenance Procedures

### Deploying Updates

**Next.js App (Vercel):**
1. Create PR with changes
2. Verify preview deployment works
3. Merge to main
4. Monitor deployment in Vercel dashboard
5. Check `/api/health` after deployment

**TCP Proxy:**
```bash
cd server

# Build new image
docker build -t Powerdon-tcp-proxy:v1.x.x .

# Stop old container
docker stop Powerdon-tcp-proxy

# Start new container
docker run -d \
  --name Powerdon-tcp-proxy \
  -p 8765:8765 \
  --env-file .env \
  --restart unless-stopped \
  Powerdon-tcp-proxy:v1.x.x
```

### Database Migrations

1. Review migration SQL in `supabase/migrations/`
2. Test on staging first
3. Apply migration:
```bash
# Via Supabase CLI
supabase db push

# Or via MCP in v0
# Use supabase_apply_migration tool
```
4. Verify with health check
5. Monitor for errors

### Restarting Services

**Never restart during peak hours unless P1 incident.**

```bash
# TCP Proxy
docker restart Powerdon-tcp-proxy

# To force reconnect all stations
docker stop Powerdon-tcp-proxy
sleep 10
docker start Powerdon-tcp-proxy
```

### Backup Procedures

**Database backups are automatic via Supabase.**

Manual backup:
```bash
# Export critical tables
supabase db dump -f backup_$(date +%Y%m%d).sql
```

## Monitoring

### Key Metrics to Watch

| Metric | Warning | Critical |
|--------|---------|----------|
| Error rate | > 5% | > 20% |
| API latency p95 | > 1s | > 5s |
| Station offline rate | > 10% | > 50% |
| Active sessions stuck > 24h | > 5 | > 20 |

### Dashboard Links

- **Ops Dashboard**: `/admin/ops`
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Metrics (Prometheus)**: `/api/metrics`

## Contacts

| Role | Contact |
|------|---------|
| On-call Engineer | Check PagerDuty schedule |
| Database Admin | devops@company.com |
| Vercel Support | vercel.com/help |
| Supabase Support | supabase.com/support |

## Escalation

1. P4/P3: Handle during business hours
2. P2: Contact on-call engineer
3. P1: Contact on-call + notify engineering lead
