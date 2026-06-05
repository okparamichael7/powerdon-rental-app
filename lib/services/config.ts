/**
 * @deprecated PWA runtime always uses production APIs (lib/data/pwa-api.ts).
 * NEXT_PUBLIC_USE_MOCK_DATA is ignored; kept for legacy env diagnostics only.
 */
export function isMockDataEnabled(): boolean {
  return false
}

/**
 * @deprecated Admin runtime always uses production services (lib/services/index.ts).
 * NEXT_PUBLIC_ADMIN_USE_MOCK_DATA is ignored; kept for legacy env diagnostics only.
 */
export function isAdminMockDataEnabled(): boolean {
  return false
}

/** Admin dashboard always loads from /api/admin and production service classes. */
export function getAdminDataSource(): 'production' {
  return 'production'
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
