/**
 * Mock data requires explicit opt-in everywhere (including development).
 * Set NEXT_PUBLIC_USE_MOCK_DATA=true only for local UI work without Supabase.
 */
export function isMockDataEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true'
}

/** True when Stripe server key is set but the PWA publishable key is missing. */
export function isStripeMisconfigured(): boolean {
  const hasSecret = Boolean(process.env.STRIPE_SECRET_KEY)
  const hasPublishable = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  return hasSecret && !hasPublishable
}

export function isStripeCheckoutEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
}
