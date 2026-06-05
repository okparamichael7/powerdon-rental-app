import type { Stripe } from 'stripe'

// =============================================================================
// STRIPE PRODUCT NAMES — checkout uses inline product_data unless
// STRIPE_RENTAL_DEPOSIT_PRODUCT_ID is set (see payment-service buildDepositPriceData).
// =============================================================================

export const STRIPE_PRODUCTS = {
  RENTAL_DEPOSIT: {
    productId: 'prod_UcU1phsdl2ANSE', // legacy test id; not used by default checkout path
    priceId: 'price_1TdFOdDPW7Z1YWdIO8ieL7E0', // EUR price
    name: 'Power Bank Rental Deposit',
    description: 'Security deposit for power bank rental - refundable upon return',
    amountCents: 2800, // €28.00
  },
  RENTAL_FEE: {
    productId: 'prod_UcU1C0M83l5QO2',
    priceId: 'price_1TdFOdDPW7Z1YWdI5DHDS8Nk', // EUR price
    name: 'Power Bank Rental Fee',
    description: 'Per 15-minute rental fee for power bank usage',
    amountCents: 100, // €1.00 per 15 minutes
  },
} as const

// =============================================================================
// PRICING CONFIGURATION - Ladder Billing Model
// =============================================================================

export type BillingModel = 'ladder' | 'linear' | 'flat'

export interface PricingTier {
  fromMinutes: number
  toMinutes: number | null // null = unlimited
  ratePerIntervalCents: number
  intervalMinutes: number
}

export interface PricingConfig {
  // Pre-authorization
  preAuthAmountCents: number
  
  // Billing model
  billingModel: BillingModel
  currency: string
  taxIncluded: boolean
  
  // Time limits
  freeMinutes: number
  maxRentalMinutes: number
  
  // Caps
  dailyCapAmountCents: number
  lostDeviceChargeCents: number
  
  // Ladder pricing tiers (used when billingModel = 'ladder')
  tiers: PricingTier[]
}

export const DEFAULT_PRICING: PricingConfig = {
  // Pre-auth: €28.00
  preAuthAmountCents: 2800,
  
  // Billing configuration
  billingModel: 'ladder',
  currency: 'eur',
  taxIncluded: true,
  
  // Time limits
  freeMinutes: 5, // First 5 minutes free
  maxRentalMinutes: 24 * 60, // 24 hours max
  
  // Caps
  dailyCapAmountCents: 2700, // €27.00 daily cap
  lostDeviceChargeCents: 2800, // Full pre-auth for lost device
  
  // Ladder pricing: €1.00 per 15 minutes after free period
  tiers: [
    {
      fromMinutes: 0,
      toMinutes: 5,
      ratePerIntervalCents: 0, // Free
      intervalMinutes: 5,
    },
    {
      fromMinutes: 5,
      toMinutes: null, // Unlimited
      ratePerIntervalCents: 100, // €1.00
      intervalMinutes: 15,
    },
  ],
}

// Legacy compatibility - maps to new structure
export const LEGACY_PRICING = {
  depositAmountCents: DEFAULT_PRICING.preAuthAmountCents,
  hourlyRateCents: 400, // €4.00/hour equivalent (4 x €1.00/15min)
  minimumChargeCents: 0,
  maximumChargeCents: DEFAULT_PRICING.dailyCapAmountCents,
  currency: DEFAULT_PRICING.currency,
  freeMinutes: DEFAULT_PRICING.freeMinutes,
  lostDeviceChargeCents: DEFAULT_PRICING.lostDeviceChargeCents,
  maxRentalHours: DEFAULT_PRICING.maxRentalMinutes / 60,
}

// =============================================================================
// PAYMENT TYPES
// =============================================================================

export type PaymentStatus = 
  | 'pending'
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'authorized'
  | 'captured'
  | 'canceled'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'

export interface PaymentIntentMetadata {
  sessionId: string
  userId: string
  stationId: string
  slotNumber: string
  campaignId?: string
  type: 'rental_deposit' | 'rental_charge' | 'lost_device'
}

export interface CreatePaymentIntentParams {
  amountCents: number
  customerId?: string
  customerEmail: string
  metadata: PaymentIntentMetadata
  idempotencyKey: string
  captureMethod?: 'automatic' | 'manual'
  description?: string
  statementDescriptor?: string
}

export interface CapturePaymentParams {
  paymentIntentId: string
  amountToCaptureCents?: number // If not provided, captures full authorized amount
  metadata?: Record<string, string>
}

export interface RefundPaymentParams {
  paymentIntentId: string
  amountCents?: number // If not provided, refunds full amount
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  metadata?: Record<string, string>
}

// =============================================================================
// CUSTOMER TYPES
// =============================================================================

export interface CreateCustomerParams {
  email: string
  name?: string
  phone?: string
  metadata?: Record<string, string>
}

export interface CustomerData {
  id: string
  email: string
  name?: string
  phone?: string
  defaultPaymentMethodId?: string
  metadata: Record<string, string>
  created: Date
}

// =============================================================================
// CHECKOUT SESSION TYPES
// =============================================================================

export interface CreateCheckoutSessionParams {
  customerId?: string
  customerEmail: string
  sessionId: string
  userId: string
  stationId: string
  slotNumber: number
  campaignId?: string
  depositAmountCents: number
  successUrl: string
  cancelUrl: string
}

export interface CheckoutSessionResult {
  sessionId: string
  clientSecret: string
  url?: string
}

// =============================================================================
// WEBHOOK TYPES
// =============================================================================

export type WebhookEventType = 
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'payment_intent.canceled'
  | 'payment_intent.amount_capturable_updated'
  | 'payment_intent.requires_action'
  | 'charge.succeeded'
  | 'charge.failed'
  | 'charge.refunded'
  | 'charge.dispute.created'
  | 'charge.dispute.closed'
  | 'customer.created'
  | 'customer.updated'
  | 'checkout.session.completed'
  | 'checkout.session.expired'

export interface WebhookEvent {
  id: string
  type: WebhookEventType
  data: {
    object: Stripe.PaymentIntent | Stripe.Charge | Stripe.Customer | Stripe.Checkout.Session | Stripe.Dispute
  }
  created: number
  livemode: boolean
}

export interface WebhookHandlerResult {
  success: boolean
  message: string
  processedAt: Date
}

// =============================================================================
// BILLING REPORT TYPES
// =============================================================================

export interface BillingReportFilters {
  startDate: Date
  endDate: Date
  status?: PaymentStatus[]
  customerId?: string
  minAmount?: number
  maxAmount?: number
}

export interface BillingSummary {
  totalRevenueCents: number
  totalRefundsCents: number
  netRevenueCents: number
  totalTransactions: number
  successfulTransactions: number
  failedTransactions: number
  refundedTransactions: number
  averageTransactionCents: number
  disputeCount: number
  disputeAmountCents: number
}

export interface TransactionRecord {
  id: string
  paymentIntentId: string
  customerId?: string
  customerEmail?: string
  amountCents: number
  capturedAmountCents: number
  refundedAmountCents: number
  currency: string
  status: PaymentStatus
  type: 'rental_deposit' | 'rental_charge' | 'lost_device'
  sessionId?: string
  metadata: Record<string, string>
  createdAt: Date
  updatedAt: Date
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export class StripeServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public retryable: boolean = false,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'StripeServiceError'
  }

  static fromStripeError(error: InstanceType<typeof Stripe.errors.StripeError>): StripeServiceError {
    const retryable = ['rate_limit_error', 'api_connection_error'].includes(error.type)
    const statusCode = error.statusCode || 500
    
    return new StripeServiceError(
      error.message,
      error.code || error.type,
      statusCode,
      retryable,
      error
    )
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate rental charge using ladder billing model
 * 
 * Rules:
 * - First 5 minutes free
 * - €1.00 per 15 minutes after free period
 * - Daily cap of €27.00
 * - Tax included in all prices
 */
export function calculateRentalCharge(
  durationMinutes: number,
  pricing: PricingConfig = DEFAULT_PRICING
): { 
  totalCents: number
  breakdown: Array<{ tier: string; minutes: number; charge: number }>
  cappedAt?: number
} {
  const breakdown: Array<{ tier: string; minutes: number; charge: number }> = []
  let totalCents = 0
  let remainingMinutes = durationMinutes
  
  // Process each tier in order
  for (const tier of pricing.tiers) {
    if (remainingMinutes <= 0) break
    
    // Calculate minutes in this tier
    const tierStart = tier.fromMinutes
    const tierEnd = tier.toMinutes ?? Infinity
    const tierDuration = tierEnd - tierStart
    
    // Skip if we haven't reached this tier yet
    if (durationMinutes <= tierStart) continue
    
    // Calculate how many minutes fall into this tier
    const minutesInTier = Math.min(
      remainingMinutes,
      tierDuration,
      Math.max(0, durationMinutes - tierStart)
    )
    
    if (minutesInTier <= 0) continue
    
    // Calculate charge for this tier
    if (tier.ratePerIntervalCents > 0) {
      // Round up to the nearest interval
      const intervals = Math.ceil(minutesInTier / tier.intervalMinutes)
      const tierCharge = intervals * tier.ratePerIntervalCents
      
      totalCents += tierCharge
      breakdown.push({
        tier: tier.ratePerIntervalCents === 0 
          ? 'Free period' 
          : `€${(tier.ratePerIntervalCents / 100).toFixed(2)}/${tier.intervalMinutes}min`,
        minutes: minutesInTier,
        charge: tierCharge,
      })
    } else {
      breakdown.push({
        tier: 'Free period',
        minutes: minutesInTier,
        charge: 0,
      })
    }
    
    remainingMinutes -= minutesInTier
  }
  
  // Apply daily cap
  const cappedAt = totalCents > pricing.dailyCapAmountCents 
    ? pricing.dailyCapAmountCents 
    : undefined
  
  if (cappedAt !== undefined) {
    totalCents = pricing.dailyCapAmountCents
  }
  
  return { totalCents, breakdown, cappedAt }
}

/**
 * Simple charge calculation (returns just the total)
 */
export function calculateSimpleCharge(
  durationMinutes: number,
  pricing: PricingConfig = DEFAULT_PRICING
): number {
  return calculateRentalCharge(durationMinutes, pricing).totalCents
}

/**
 * Format cents to display currency
 */
export function formatCurrency(cents: number, currency: string = 'eur'): string {
  const amount = cents / 100
  const locale = currency.toLowerCase() === 'eur' ? 'de-DE' : 'en-US'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount)
}

/**
 * Generate idempotency key for Stripe requests
 */
export function generateIdempotencyKey(prefix: string, ...parts: string[]): string {
  return `${prefix}_${parts.join('_')}_${Date.now()}`
}

/**
 * Map Stripe PaymentIntent status to our internal status
 */
export function mapPaymentIntentStatus(
  status: Stripe.PaymentIntent.Status,
  captureMethod?: string | null,
  amountCapturable?: number
): PaymentStatus {
  switch (status) {
    case 'requires_payment_method':
      return 'requires_payment_method'
    case 'requires_confirmation':
      return 'requires_confirmation'
    case 'requires_action':
      return 'requires_action'
    case 'processing':
      return 'processing'
    case 'requires_capture':
      return 'authorized'
    case 'succeeded':
      return 'captured'
    case 'canceled':
      return 'canceled'
    default:
      return 'pending'
  }
}
