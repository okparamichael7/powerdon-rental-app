import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/db/types'

/**
 * Server-only Supabase client with service role (bypasses RLS).
 * Use for API routes, server actions, and repositories — never expose to the browser.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Required for server-side database access.',
    )
  }

  const client = createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client as any
}
