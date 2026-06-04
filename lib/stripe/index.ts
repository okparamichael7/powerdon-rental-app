import 'server-only'

import Stripe from 'stripe'

// Lazy initialization to avoid build-time errors when env vars aren't available
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const apiKey = process.env.STRIPE_SECRET_KEY
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    _stripe = new Stripe(apiKey, {
      apiVersion: '2026-05-27.dahlia',
      appInfo: {
        name: 'PowerDon Rental Platform',
        version: '1.0.0',
      },
      typescript: true,
    })
  }
  return _stripe
}

// For backwards compatibility - getter that lazily initializes
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

// Re-export types for convenience
export type { Stripe }
