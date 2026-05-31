import type { Stripe } from 'stripe'

// =============================================================================
// STRIPE PRODUCT IDS - Created in Stripe Dashboard/API
// =============================================================================

export const STRIPE_PRODUCTS = {
  RENTAL_DEPOSIT: {
    productId: 'prod_UcU1phsdl2ANSE',
    priceId: 'price_1TdF3ODPW7Z1YWdIPWntTLoy',
    name: 'Power Bank Rental Deposit',
    description: 'Security deposit for power bank rental - refundable upon return',
    amountCents: 2000, // $20.00
  },
  RENTAL_FEE: {
    productId: 'prod_UcU1C0M83l5QO2',
    priceId: 'price_1TdF3ODPW7Z1YWdIK5cItJaB',
    name: 'Power Bank Rental Fee',
    description: 'Hourly rental fee for power bank usage',
    amountCents: 100, // $1.00 per hour
  },
} as const

// =============================================================================
// PRICING CONFIGURATION
// =============================================================================

export interface PricingConfig {
  depositAmountCents: number
  hourlyRateCents: number
  minimumChargeCents: number
  maximumChargeCents: number
  currency: string
  freeMinutes: number // Grace period before charging starts
  lostDeviceChargeCents: number
  maxRentalHours: number
}

export const DEFAULT_PRICING: PricingConfig = {
  depositAmountCents: 2000, // $20.00 deposit
  hourlyRateCents: 100, // $1.00/hour
  minimumChargeCents: 0, // No minimum
  maximumChargeCents: 2000, // Max $20.00 (deposit amount)
  currency: 'usd',
  freeMinutes: 5, // 5 minute grace period
  lostDeviceChargeCents: 2000, // Full deposit for lost device
  maxRentalHours: 72, // 3 days max rental
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

  static fromStripeError(error: Stripe.errors.StripeError): StripeServiceError {
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
 * Calculate rental charge based on duration
 */
export function calculateRentalCharge(
  durationMinutes: number,
  pricing: PricingConfig = DEFAULT_PRICING
): number {
  // Apply free minutes grace period
  const chargeableMinutes = Math.max(0, durationMinutes - pricing.freeMinutes)
  
  if (chargeableMinutes === 0) {
    return 0
  }
  
  // Calculate hours (round up)
  const hours = Math.ceil(chargeableMinutes / 60)
  
  // Calculate charge
  let chargeCents = hours * pricing.hourlyRateCents
  
  // Apply minimum
  chargeCents = Math.max(chargeCents, pricing.minimumChargeCents)
  
  // Apply maximum (cap at deposit amount)
  chargeCents = Math.min(chargeCents, pricing.maximumChargeCents)
  
  return chargeCents
}

/**
 * Format cents to display currency
 */
export function formatCurrency(cents: number, currency: string = 'usd'): string {
  const amount = cents / 100
  return new Intl.NumberFormat('en-US', {
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
