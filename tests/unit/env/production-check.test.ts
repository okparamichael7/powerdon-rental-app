import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getProductionEnvChecks, productionEnvReady } from '@/lib/env/production-check'
import { withEnv } from '../../helpers/env'

describe('productionEnvReady', () => {
  it('returns false when required production vars missing', async () => {
    await withEnv(
      {
        NODE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: '',
        SUPABASE_SERVICE_ROLE_KEY: '',
        STRIPE_SECRET_KEY: '',
      },
      () => {
        assert.equal(productionEnvReady(), false)
      },
    )
  })

  it('returns true when all required production vars present', async () => {
    await withEnv(
      {
        NODE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-key',
        STRIPE_SECRET_KEY: 'sk_test',
        STRIPE_WEBHOOK_SECRET: 'whsec_test',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test',
        STATION_PROXY_TOKEN: 'proxy-token',
        CRON_SECRET: 'cron-secret',
        METRICS_API_KEY: 'metrics-key',
        NEXT_PUBLIC_USE_MOCK_DATA: 'false',
        NEXT_PUBLIC_ADMIN_USE_MOCK_DATA: 'false',
        ALLOW_INSECURE_HARDWARE_DEV: 'false',
      },
      () => {
        assert.equal(productionEnvReady(), true)
      },
    )
  })

  it('flags mock data as not production-ready', async () => {
    await withEnv(
      {
        NODE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-key',
        STRIPE_SECRET_KEY: 'sk_test',
        STRIPE_WEBHOOK_SECRET: 'whsec_test',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test',
        STATION_PROXY_TOKEN: 'proxy-token',
        CRON_SECRET: 'cron-secret',
        METRICS_API_KEY: 'metrics-key',
        NEXT_PUBLIC_USE_MOCK_DATA: 'true',
      },
      () => {
        const checks = getProductionEnvChecks()
        const mockCheck = checks.find((c) => c.name.includes('MOCK_DATA'))
        assert.ok(mockCheck)
        assert.equal(mockCheck!.ok, false)
      },
    )
  })
})
