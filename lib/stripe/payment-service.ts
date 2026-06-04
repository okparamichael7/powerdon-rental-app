import 'server-only'

import type Stripe from 'stripe'
import { stripe } from './index'
import {
  type CreatePaymentIntentParams,
  type CapturePaymentParams,
  type RefundPaymentParams,
  type CreateCustomerParams,
  type CustomerData,
  type CreateCheckoutSessionParams,
  type CheckoutSessionResult,
  type PaymentStatus,
  type PricingConfig,
  StripeServiceError,
  DEFAULT_PRICING,
  STRIPE_PRODUCTS,
  mapPaymentIntentStatus,
  calculateRentalCharge,
  calculateSimpleCharge,
  generateIdempotencyKey,
} from './types'
import { logger } from '@/lib/observability/logger'

// =============================================================================
// CUSTOMER MANAGEMENT
// =============================================================================

/**
 * Create a new Stripe customer
 */
export async function createCustomer(params: CreateCustomerParams): Promise<CustomerData> {
  const span = logger.startSpan('stripe.createCustomer')
  
  try {
    const customer = await stripe.customers.create({
      email: params.email,
      name: params.name,
      phone: params.phone,
      metadata: {
        ...params.metadata,
        source: 'powerdon_rental',
        created_via: 'api',
      },
    })

    logger.info('Customer created', {
      customerId: customer.id,
      email: params.email,
    })

    return {
      id: customer.id,
      email: customer.email!,
      name: customer.name || undefined,
      phone: customer.phone || undefined,
      defaultPaymentMethodId: typeof customer.invoice_settings?.default_payment_method === 'string'
        ? customer.invoice_settings.default_payment_method
        : customer.invoice_settings?.default_payment_method?.id,
      metadata: customer.metadata as Record<string, string>,
      created: new Date(customer.created * 1000),
    }
  } catch (error) {
    logger.error('Failed to create customer', { error: error instanceof Error ? error : String(error), email: params.email })
    throw handleStripeError(error)
  } finally {
    span.end()
  }
}

/**
 * Get or create a customer by email
 */
export async function getOrCreateCustomer(params: CreateCustomerParams): Promise<CustomerData> {
  const span = logger.startSpan('stripe.getOrCreateCustomer')
  
  try {
    // Search for existing customer
    const existingCustomers = await stripe.customers.list({
      email: params.email,
      limit: 1,
    })

    if (existingCustomers.data.length > 0) {
      const customer = existingCustomers.data[0]
      logger.info('Found existing customer', { customerId: customer.id })
      
      return {
        id: customer.id,
        email: customer.email!,
        name: customer.name || undefined,
        phone: customer.phone || undefined,
        defaultPaymentMethodId: typeof customer.invoice_settings?.default_payment_method === 'string'
          ? customer.invoice_settings.default_payment_method
          : customer.invoice_settings?.default_payment_method?.id,
        metadata: customer.metadata as Record<string, string>,
        created: new Date(customer.created * 1000),
      }
    }

    // Create new customer
    return await createCustomer(params)
  } catch (error) {
    logger.error('Failed to get or create customer', { error: error instanceof Error ? error : String(error), email: params.email })
    throw handleStripeError(error)
  } finally {
    span.end()
  }
}

/**
 * Update customer default payment method
 */
export async function updateCustomerPaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<void> {
  const span = logger.startSpan('stripe.updateCustomerPaymentMethod')
  
  try {
    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    })

    // Set as default
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    })

    logger.info('Updated customer payment method', { customerId, paymentMethodId })
  } catch (error) {
    logger.error('Failed to update customer payment method', { error: error instanceof Error ? error : String(error), customerId })
    throw handleStripeError(error)
  } finally {
    span.end()
  }
}

// =============================================================================
// PAYMENT INTENT MANAGEMENT (Authorization/Capture Flow)
// =============================================================================

/**
 * Create a payment intent with manual capture (authorization hold)
 * This places a hold on the customer's card without capturing funds
 */
export async function createPaymentIntentWithHold(
  params: CreatePaymentIntentParams
): Promise<Stripe.PaymentIntent> {
  const span = logger.startSpan('stripe.createPaymentIntentWithHold')
  
  try {
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: params.amountCents,
        currency: DEFAULT_PRICING.currency, // EUR
        customer: params.customerId,
        capture_method: params.captureMethod || 'manual', // Manual = authorization only
        receipt_email: params.customerEmail,
        description: params.description || 'Power Bank Rental Deposit',
        statement_descriptor_suffix: params.statementDescriptor || 'POWERDON',
        metadata: {
          session_id: params.metadata.sessionId,
          user_id: params.metadata.userId,
          station_id: params.metadata.stationId,
          slot_number: params.metadata.slotNumber,
          campaign_id: params.metadata.campaignId || '',
          type: params.metadata.type,
          created_at: new Date().toISOString(),
        },
        automatic_payment_methods: {
          enabled: true,
        },
      },
      {
        idempotencyKey: params.idempotencyKey,
      }
    )

    logger.info('Payment intent created with hold', {
      paymentIntentId: paymentIntent.id,
      amount: params.amountCents,
      sessionId: params.metadata.sessionId,
      status: paymentIntent.status,
    })

    return paymentIntent
  } catch (error) {
    logger.error('Failed to create payment intent', {
      error: error instanceof Error ? error : String(error),
      sessionId: params.metadata.sessionId,
    })
    throw handleStripeError(error)
  } finally {
    span.end()
  }
}

/**
 * Capture a previously authorized payment (partial or full)
 * Use this when the rental is completed to charge the actual amount
 */
export async function capturePayment(
  params: CapturePaymentParams
): Promise<Stripe.PaymentIntent> {
  const span = logger.startSpan('stripe.capturePayment')
  
  try {
    // First retrieve the payment intent to get the authorized amount
    const paymentIntent = await stripe.paymentIntents.retrieve(params.paymentIntentId)
    
    if (paymentIntent.status !== 'requires_capture') {
      throw new StripeServiceError(
        `Payment intent cannot be captured. Current status: ${paymentIntent.status}`,
        'invalid_capture_state',
        400
      )
    }

    const captureParams: Stripe.PaymentIntentCaptureParams = {
      metadata: {
        ...paymentIntent.metadata,
        captured_at: new Date().toISOString(),
        ...params.metadata,
      },
    }

    // If amount specified, do partial capture
    if (params.amountToCaptureCents !== undefined) {
      captureParams.amount_to_capture = params.amountToCaptureCents
    }

    const capturedIntent = await stripe.paymentIntents.capture(
      params.paymentIntentId,
      captureParams
    )

    logger.info('Payment captured', {
      paymentIntentId: params.paymentIntentId,
      authorizedAmount: paymentIntent.amount,
      capturedAmount: capturedIntent.amount_received,
      sessionId: paymentIntent.metadata.session_id,
    })

    return capturedIntent
  } catch (error) {
    logger.error('Failed to capture payment', {
      error: error instanceof Error ? error : String(error),
      paymentIntentId: params.paymentIntentId,
    })
    throw handleStripeError(error)
  } finally {
    span.end()
  }
}

/**
 * Cancel a payment intent (release the hold)
 * Use this if the rental is cancelled before the power bank is dispensed
 */
export async function cancelPaymentIntent(
  paymentIntentId: string,
  cancellationReason?: string
): Promise<Stripe.PaymentIntent> {
  const span = logger.startSpan('stripe.cancelPaymentIntent')
  
  try {
    if (cancellationReason) {
      await stripe.paymentIntents.update(paymentIntentId, {
        metadata: {
          canceled_at: new Date().toISOString(),
          cancellation_reason: cancellationReason,
        },
      })
    }

    const canceledIntent = await stripe.paymentIntents.cancel(paymentIntentId, {
      cancellation_reason: 'requested_by_customer',
    })

    logger.info('Payment intent canceled', {
      paymentIntentId,
      sessionId: canceledIntent.metadata.session_id,
    })

    return canceledIntent
  } catch (error) {
    logger.error('Failed to cancel payment intent', { error: error instanceof Error ? error : String(error), paymentIntentId })
    throw handleStripeError(error)
  } finally {
    span.end()
  }
}

/**
 * Create a refund for a captured payment
 */
export async function createRefund(
  params: RefundPaymentParams
): Promise<Stripe.Refund> {
  const span = logger.startSpan('stripe.createRefund')
  
  try {
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: params.paymentIntentId,
      reason: params.reason,
      metadata: {
        refunded_at: new Date().toISOString(),
        ...params.metadata,
      },
    }

    if (params.amountCents !== undefined) {
      refundParams.amount = params.amountCents
    }

    const refund = await stripe.refunds.create(refundParams)

    logger.info('Refund created', {
      refundId: refund.id,
      paymentIntentId: params.paymentIntentId,
      amount: refund.amount,
      status: refund.status,
    })

    return refund
  } catch (error) {
    logger.error('Failed to create refund', {
      error: error instanceof Error ? error : String(error),
      paymentIntentId: params.paymentIntentId,
    })
    throw handleStripeError(error)
  } finally {
    span.end()
  }
}

/**
 * Get payment intent status and details
 */
export async function getPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  const span = logger.startSpan('stripe.getPaymentIntent')
  
  try {
    return await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['customer', 'payment_method', 'charges'],
    })
  } catch (error) {
    logger.error('Failed to retrieve payment intent', { error: error instanceof Error ? error : String(error), paymentIntentId })
    throw handleStripeError(error)
  } finally {
    span.end()
  }
}

// =============================================================================
// CHECKOUT SESSION MANAGEMENT
// =============================================================================

/**
 * Create an embedded checkout session for rental deposit
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<CheckoutSessionResult> {
  const span = logger.startSpan('stripe.createCheckoutSession')
  
  try {
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded' as Stripe.Checkout.SessionCreateParams['ui_mode'],
      mode: 'payment',
      customer: params.customerId,
      customer_email: params.customerId ? undefined : params.customerEmail,
      payment_intent_data: {
        capture_method: 'manual', // Authorization hold
        metadata: {
          session_id: params.sessionId,
          user_id: params.userId,
          station_id: params.stationId,
          slot_number: String(params.slotNumber),
          campaign_id: params.campaignId || '',
          type: 'rental_deposit',
        },
        statement_descriptor_suffix: 'POWERDON',
      },
      line_items: [
        {
          price_data: {
            currency: DEFAULT_PRICING.currency, // EUR
            product: STRIPE_PRODUCTS.RENTAL_DEPOSIT.productId,
            unit_amount: params.depositAmountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        session_id: params.sessionId,
        user_id: params.userId,
        station_id: params.stationId,
        slot_number: String(params.slotNumber),
      },
      redirect_on_completion: 'never',
    })

    logger.info('Checkout session created', {
      checkoutSessionId: session.id,
      sessionId: params.sessionId,
      amount: params.depositAmountCents,
    })

    return {
      sessionId: session.id,
      clientSecret: session.client_secret!,
      url: session.url || undefined,
    }
  } catch (error) {
    logger.error('Failed to create checkout session', {
      error: error instanceof Error ? error : String(error),
      sessionId: params.sessionId,
    })
    throw handleStripeError(error)
  } finally {
    span.end()
  }
}

/**
 * Retrieve checkout session status
 */
export async function getCheckoutSession(
  checkoutSessionId: string
): Promise<Stripe.Checkout.Session> {
  const span = logger.startSpan('stripe.getCheckoutSession')
  
  try {
    return await stripe.checkout.sessions.retrieve(checkoutSessionId, {
      expand: ['payment_intent', 'customer'],
    })
  } catch (error) {
    logger.error('Failed to retrieve checkout session', { error: error instanceof Error ? error : String(error), checkoutSessionId })
    throw handleStripeError(error)
  } finally {
    span.end()
  }
}

// =============================================================================
// RENTAL-SPECIFIC PAYMENT FLOWS
// =============================================================================

/**
 * Complete rental payment flow:
 * 1. Calculate actual charge based on duration using ladder billing
 * 2. Capture the appropriate amount (partial capture releases the rest)
 * 
 * Pricing rules:
 * - Pre-auth: €28.00
 * - First 5 minutes: Free
 * - After free period: €1.00 per 15 minutes
 * - Daily cap: €27.00
 * - Tax: Included
 */
export async function completeRentalPayment(
  paymentIntentId: string,
  durationMinutes: number,
  pricing: PricingConfig = DEFAULT_PRICING
): Promise<{
  paymentIntent: Stripe.PaymentIntent
  chargedAmountCents: number
  refundedAmountCents: number
  breakdown: Array<{ tier: string; minutes: number; charge: number }>
  wasCapped: boolean
}> {
  const span = logger.startSpan('stripe.completeRentalPayment')
  
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    const authorizedAmount = paymentIntent.amount
    
    // Calculate actual charge using ladder billing
    const { totalCents: actualChargeCents, breakdown, cappedAt } = calculateRentalCharge(durationMinutes, pricing)
    const wasCapped = cappedAt !== undefined
    
    logger.info('Completing rental payment', {
      paymentIntentId,
      durationMinutes,
      authorizedAmount,
      actualChargeCents,
      wasCapped,
      breakdown,
    })

    // If no charge (within free period), cancel the authorization
    if (actualChargeCents === 0) {
      const canceled = await cancelPaymentIntent(paymentIntentId, 'no_charge_free_period')
      return {
        paymentIntent: canceled,
        chargedAmountCents: 0,
        refundedAmountCents: 0,
        breakdown,
        wasCapped: false,
      }
    }

    // Capture the actual amount (partial capture)
    const captured = await capturePayment({
      paymentIntentId,
      amountToCaptureCents: actualChargeCents,
      metadata: {
        duration_minutes: String(durationMinutes),
        charged_amount: String(actualChargeCents),
        authorized_amount: String(authorizedAmount),
        was_capped: String(wasCapped),
        billing_model: 'ladder',
      },
    })

    return {
      paymentIntent: captured,
      chargedAmountCents: actualChargeCents,
      refundedAmountCents: 0, // Partial capture automatically releases the rest
      breakdown,
      wasCapped,
    }
  } catch (error) {
    logger.error('Failed to complete rental payment', {
      error: error instanceof Error ? error : String(error),
      paymentIntentId,
      durationMinutes,
    })
    throw handleStripeError(error)
  } finally {
    span.end()
  }
}

/**
 * Handle lost device - capture full deposit
 */
export async function handleLostDevice(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  const span = logger.startSpan('stripe.handleLostDevice')
  
  try {
    const captured = await capturePayment({
      paymentIntentId,
      // Capture full amount (no amountToCaptureCents means full capture)
      metadata: {
        lost_device: 'true',
        captured_reason: 'device_not_returned',
      },
    })

    logger.warn('Lost device - full deposit captured', {
      paymentIntentId,
      amount: captured.amount_received,
    })

    return captured
  } catch (error) {
    logger.error('Failed to handle lost device payment', { error: error instanceof Error ? error : String(error), paymentIntentId })
    throw handleStripeError(error)
  } finally {
    span.end()
  }
}

// =============================================================================
// BILLING REPORTS
// =============================================================================

/**
 * Get payment intents for billing report
 */
export async function getPaymentIntentsForReport(
  startDate: Date,
  endDate: Date,
  limit: number = 100
): Promise<Stripe.PaymentIntent[]> {
  const span = logger.startSpan('stripe.getPaymentIntentsForReport')
  
  try {
    const paymentIntents: Stripe.PaymentIntent[] = []
    let hasMore = true
    let startingAfter: string | undefined

    while (hasMore && paymentIntents.length < limit) {
      const response = await stripe.paymentIntents.list({
        created: {
          gte: Math.floor(startDate.getTime() / 1000),
          lte: Math.floor(endDate.getTime() / 1000),
        },
        limit: Math.min(100, limit - paymentIntents.length),
        starting_after: startingAfter,
        expand: ['data.customer'],
      })

      paymentIntents.push(...response.data)
      hasMore = response.has_more
      
      if (response.data.length > 0) {
        startingAfter = response.data[response.data.length - 1].id
      }
    }

    return paymentIntents
  } catch (error) {
    logger.error('Failed to get payment intents for report', { error: error instanceof Error ? error : String(error) })
    throw handleStripeError(error)
  } finally {
    span.end()
  }
}

/**
 * Get refunds for billing report
 */
export async function getRefundsForReport(
  startDate: Date,
  endDate: Date,
  limit: number = 100
): Promise<Stripe.Refund[]> {
  const span = logger.startSpan('stripe.getRefundsForReport')
  
  try {
    const refunds: Stripe.Refund[] = []
    let hasMore = true
    let startingAfter: string | undefined

    while (hasMore && refunds.length < limit) {
      const response = await stripe.refunds.list({
        created: {
          gte: Math.floor(startDate.getTime() / 1000),
          lte: Math.floor(endDate.getTime() / 1000),
        },
        limit: Math.min(100, limit - refunds.length),
        starting_after: startingAfter,
      })

      refunds.push(...response.data)
      hasMore = response.has_more
      
      if (response.data.length > 0) {
        startingAfter = response.data[response.data.length - 1].id
      }
    }

    return refunds
  } catch (error) {
    logger.error('Failed to get refunds for report', { error: error instanceof Error ? error : String(error) })
    throw handleStripeError(error)
  } finally {
    span.end()
  }
}

/**
 * Get disputes
 */
export async function getDisputes(
  limit: number = 100
): Promise<Stripe.Dispute[]> {
  const span = logger.startSpan('stripe.getDisputes')
  
  try {
    const response = await stripe.disputes.list({ limit })
    return response.data
  } catch (error) {
    logger.error('Failed to get disputes', { error: error instanceof Error ? error : String(error) })
    throw handleStripeError(error)
  } finally {
    span.end()
  }
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

function handleStripeError(error: unknown): StripeServiceError {
  if (error instanceof StripeServiceError) {
    return error
  }

  if (error instanceof stripe.errors.StripeError) {
    return StripeServiceError.fromStripeError(error)
  }

  if (error instanceof Error) {
    return new StripeServiceError(
      error.message,
      'unknown_error',
      500,
      false,
      error
    )
  }

  return new StripeServiceError(
    'An unknown error occurred',
    'unknown_error',
    500,
    false
  )
}
