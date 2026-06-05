export type EnvCheck = { name: string; ok: boolean; required: boolean }

export function getProductionEnvChecks(): EnvCheck[] {
  const isProd = process.env.NODE_ENV === 'production'
  const required = (name: string, value: string | undefined): EnvCheck => ({
    name,
    ok: Boolean(value?.trim()),
    required: isProd,
  })

  return [
    required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
    required('STRIPE_SECRET_KEY', process.env.STRIPE_SECRET_KEY),
    required('STRIPE_WEBHOOK_SECRET', process.env.STRIPE_WEBHOOK_SECRET),
    required('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    required('STATION_PROXY_TOKEN or TCP_PROXY_API_KEY', process.env.STATION_PROXY_TOKEN || process.env.TCP_PROXY_API_KEY),
    required('CRON_SECRET', process.env.CRON_SECRET),
    required('METRICS_API_KEY', process.env.METRICS_API_KEY),
    {
      name: 'NEXT_PUBLIC_USE_MOCK_DATA is false',
      ok: process.env.NEXT_PUBLIC_USE_MOCK_DATA !== 'true',
      required: isProd,
    },
    {
      name: 'NEXT_PUBLIC_ADMIN_USE_MOCK_DATA is false',
      ok: process.env.NEXT_PUBLIC_ADMIN_USE_MOCK_DATA !== 'true',
      required: isProd,
    },
    {
      name: 'ALLOW_INSECURE_HARDWARE_DEV is false',
      ok: process.env.ALLOW_INSECURE_HARDWARE_DEV !== 'true',
      required: isProd,
    },
    {
      name: 'UPSTASH_REDIS_REST (distributed rate limits)',
      ok: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
      required: false,
    },
  ]
}

export function productionEnvReady(): boolean {
  const checks = getProductionEnvChecks()
  return checks.filter((c) => c.required).every((c) => c.ok)
}
