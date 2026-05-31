import 'server-only'

import Stripe from 'stripe'

// Initialize Stripe with API version and app info for better debugging
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil',
  appInfo: {
    name: 'PowerDon Rental Platform',
    version: '1.0.0',
  },
  typescript: true,
})

// Re-export types for convenience
export type { Stripe }
