import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { logger } from '@/lib/observability/logger'
import { createClient } from '@/lib/supabase/server'
import { alertManager, type AlertSeverity } from '@/lib/ops/alerting'

// Webhook secret from environment
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

// =============================================================================
// WEBHOOK ENDPOINT
// =============================================================================

export async function POST(request: NextRequest) {
  const span = logger.startSpan('stripe.webhook')
  
  try {
    // Get raw body for signature verification
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      logger.warn('Webhook received without signature')
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    if (!WEBHOOK_SECRET) {
      logger.error('STRIPE_WEBHOOK_SECRET not configured')
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      )
    }

    // Verify signature and construct event
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET)
    } catch (err) {
      const error = err as Error
      logger.error('Webhook signature verification failed', {
        error: error.message,
      })
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      )
    }

    logger.info('Webhook received', {
      eventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
    })

    // Handle the event
    const result = await handleWebhookEvent(event)

    if (!result.success) {
      logger.error('Webhook handler failed', {
        eventId: event.id,
        eventType: event.type,
        message: result.message,
      })
      // Return 200 to acknowledge receipt but log the error
      // This prevents Stripe from retrying if the error is not recoverable
    }

    return NextResponse.json({
      received: true,
      eventId: event.id,
      processed: result.success,
    })
  } catch (error) {
    logger.error('Webhook processing error', { error })
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  } finally {
    span.end()
  }
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

interface WebhookResult {
  success: boolean
  message: string
}

async function handleWebhookEvent(event: Stripe.Event): Promise<WebhookResult> {
  switch (event.type) {
    // Payment Intent Events
    case 'payment_intent.succeeded':
      return handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent)
    
    case 'payment_intent.payment_failed':
      return handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent)
    
    case 'payment_intent.canceled':
      return handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent)
    
    case 'payment_intent.amount_capturable_updated':
      return handlePaymentIntentAuthorized(event.data.object as Stripe.PaymentIntent)

    // Checkout Session Events
    case 'checkout.session.completed':
      return handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
    
    case 'checkout.session.expired':
      return handleCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session)

    // Charge Events
    case 'charge.refunded':
      return handleChargeRefunded(event.data.object as Stripe.Charge)
    
    case 'charge.dispute.created':
      return handleDisputeCreated(event.data.object as Stripe.Dispute)
    
    case 'charge.dispute.closed':
      return handleDisputeClosed(event.data.object as Stripe.Dispute)

    // Customer Events
    case 'customer.created':
      return handleCustomerCreated(event.data.object as Stripe.Customer)

    default:
      logger.info('Unhandled webhook event type', { eventType: event.type })
      return { success: true, message: `Unhandled event type: ${event.type}` }
  }
}

// =============================================================================
// PAYMENT INTENT HANDLERS
// =============================================================================

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<WebhookResult> {
  const sessionId = paymentIntent.metadata.session_id
  
  if (!sessionId) {
    logger.warn('Payment intent succeeded without session_id', {
      paymentIntentId: paymentIntent.id,
    })
    return { success: true, message: 'No session_id in metadata' }
  }

  try {
    const supabase = await createClient()
    
    // Update rental session with payment success
    const { error } = await supabase
      .from('rental_sessions')
      .update({
        payment_status: 'captured',
        payment_intent_id: paymentIntent.id,
        total_charge: paymentIntent.amount_received / 100,
        metadata: {
          stripe_payment_intent: paymentIntent.id,
          captured_at: new Date().toISOString(),
          amount_received: paymentIntent.amount_received,
        },
      })
      .eq('session_code', sessionId)

    if (error) {
      logger.error('Failed to update session payment status', {
        error,
        sessionId,
        paymentIntentId: paymentIntent.id,
      })
      return { success: false, message: `Database error: ${error.message}` }
    }

    logger.info('Payment intent succeeded - session updated', {
      sessionId,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount_received,
    })

    return { success: true, message: 'Payment succeeded and session updated' }
  } catch (error) {
    logger.error('Error handling payment_intent.succeeded', { error, sessionId })
    return { success: false, message: String(error) }
  }
}

async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent
): Promise<WebhookResult> {
  const sessionId = paymentIntent.metadata.session_id
  
  try {
    const supabase = await createClient()
    
    // Update rental session with payment failure
    const { error } = await supabase
      .from('rental_sessions')
      .update({
        payment_status: 'failed',
        status: 'failed',
        error_message: paymentIntent.last_payment_error?.message || 'Payment failed',
        metadata: {
          stripe_payment_intent: paymentIntent.id,
          failed_at: new Date().toISOString(),
          failure_code: paymentIntent.last_payment_error?.code,
          failure_message: paymentIntent.last_payment_error?.message,
        },
      })
      .eq('session_code', sessionId)

    if (error) {
      logger.error('Failed to update session on payment failure', { error, sessionId })
    }

    // Send alert for payment failure
    await alertManager.send({
      severity: AlertSeverity.WARNING,
      title: 'Payment Failed',
      message: `Payment failed for session ${sessionId}`,
      details: {
        paymentIntentId: paymentIntent.id,
        errorCode: paymentIntent.last_payment_error?.code,
        errorMessage: paymentIntent.last_payment_error?.message,
      },
      source: 'stripe_webhook',
    })

    logger.warn('Payment intent failed', {
      sessionId,
      paymentIntentId: paymentIntent.id,
      error: paymentIntent.last_payment_error?.message,
    })

    return { success: true, message: 'Payment failure recorded' }
  } catch (error) {
    logger.error('Error handling payment_intent.payment_failed', { error, sessionId })
    return { success: false, message: String(error) }
  }
}

async function handlePaymentIntentCanceled(
  paymentIntent: Stripe.PaymentIntent
): Promise<WebhookResult> {
  const sessionId = paymentIntent.metadata.session_id
  
  try {
    const supabase = await createClient()
    
    // Update rental session
    const { error } = await supabase
      .from('rental_sessions')
      .update({
        payment_status: 'canceled',
        metadata: {
          stripe_payment_intent: paymentIntent.id,
          canceled_at: new Date().toISOString(),
        },
      })
      .eq('session_code', sessionId)

    if (error) {
      logger.error('Failed to update session on payment cancellation', { error, sessionId })
    }

    logger.info('Payment intent canceled', { sessionId, paymentIntentId: paymentIntent.id })

    return { success: true, message: 'Payment cancellation recorded' }
  } catch (error) {
    logger.error('Error handling payment_intent.canceled', { error, sessionId })
    return { success: false, message: String(error) }
  }
}

async function handlePaymentIntentAuthorized(
  paymentIntent: Stripe.PaymentIntent
): Promise<WebhookResult> {
  const sessionId = paymentIntent.metadata.session_id
  
  if (!sessionId) {
    return { success: true, message: 'No session_id in metadata' }
  }

  try {
    const supabase = await createClient()
    
    // Update rental session with authorization
    const { error } = await supabase
      .from('rental_sessions')
      .update({
        payment_status: 'authorized',
        payment_intent_id: paymentIntent.id,
        deposit_amount: paymentIntent.amount / 100,
        metadata: {
          stripe_payment_intent: paymentIntent.id,
          authorized_at: new Date().toISOString(),
          authorized_amount: paymentIntent.amount,
        },
      })
      .eq('session_code', sessionId)

    if (error) {
      logger.error('Failed to update session authorization', { error, sessionId })
    }

    logger.info('Payment intent authorized', {
      sessionId,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
    })

    return { success: true, message: 'Authorization recorded' }
  } catch (error) {
    logger.error('Error handling authorization', { error, sessionId })
    return { success: false, message: String(error) }
  }
}

// =============================================================================
// CHECKOUT SESSION HANDLERS
// =============================================================================

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<WebhookResult> {
  const sessionId = session.metadata?.session_id
  
  if (!sessionId) {
    logger.warn('Checkout session completed without session_id', {
      checkoutSessionId: session.id,
    })
    return { success: true, message: 'No session_id in metadata' }
  }

  try {
    const supabase = await createClient()
    
    // Get the payment intent from the session
    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id

    // Update rental session
    const { error } = await supabase
      .from('rental_sessions')
      .update({
        payment_intent_id: paymentIntentId,
        payment_status: 'authorized',
        status: 'pending', // Ready for hardware unlock
        metadata: {
          checkout_session_id: session.id,
          completed_at: new Date().toISOString(),
        },
      })
      .eq('session_code', sessionId)

    if (error) {
      logger.error('Failed to update session on checkout completion', { error, sessionId })
      return { success: false, message: `Database error: ${error.message}` }
    }

    logger.info('Checkout session completed', {
      sessionId,
      checkoutSessionId: session.id,
      paymentIntentId,
    })

    return { success: true, message: 'Checkout completed and session updated' }
  } catch (error) {
    logger.error('Error handling checkout.session.completed', { error, sessionId })
    return { success: false, message: String(error) }
  }
}

async function handleCheckoutSessionExpired(
  session: Stripe.Checkout.Session
): Promise<WebhookResult> {
  const sessionId = session.metadata?.session_id
  
  if (!sessionId) {
    return { success: true, message: 'No session_id in metadata' }
  }

  try {
    const supabase = await createClient()
    
    // Update rental session as expired
    const { error } = await supabase
      .from('rental_sessions')
      .update({
        status: 'cancelled',
        payment_status: 'expired',
        error_message: 'Checkout session expired',
        metadata: {
          checkout_session_id: session.id,
          expired_at: new Date().toISOString(),
        },
      })
      .eq('session_code', sessionId)

    if (error) {
      logger.error('Failed to update session on checkout expiration', { error, sessionId })
    }

    logger.info('Checkout session expired', { sessionId, checkoutSessionId: session.id })

    return { success: true, message: 'Session expiration recorded' }
  } catch (error) {
    logger.error('Error handling checkout.session.expired', { error, sessionId })
    return { success: false, message: String(error) }
  }
}

// =============================================================================
// CHARGE HANDLERS
// =============================================================================

async function handleChargeRefunded(charge: Stripe.Charge): Promise<WebhookResult> {
  logger.info('Charge refunded', {
    chargeId: charge.id,
    amount: charge.amount_refunded,
    paymentIntentId: charge.payment_intent,
  })

  // Optionally update rental session with refund info
  // This would require looking up the session by payment_intent_id

  return { success: true, message: 'Refund recorded' }
}

async function handleDisputeCreated(dispute: Stripe.Dispute): Promise<WebhookResult> {
  // Critical alert for disputes
  await alertManager.send({
    severity: AlertSeverity.CRITICAL,
    title: 'Stripe Dispute Created',
    message: `A dispute has been created for charge ${dispute.charge}`,
    details: {
      disputeId: dispute.id,
      chargeId: typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id,
      amount: dispute.amount,
      reason: dispute.reason,
      status: dispute.status,
    },
    source: 'stripe_webhook',
  })

  logger.error('Dispute created - requires immediate attention', {
    disputeId: dispute.id,
    amount: dispute.amount,
    reason: dispute.reason,
  })

  return { success: true, message: 'Dispute alert sent' }
}

async function handleDisputeClosed(dispute: Stripe.Dispute): Promise<WebhookResult> {
  const won = dispute.status === 'won'
  
  await alertManager.send({
    severity: won ? AlertSeverity.INFO : AlertSeverity.WARNING,
    title: `Stripe Dispute ${won ? 'Won' : 'Lost'}`,
    message: `Dispute ${dispute.id} has been ${dispute.status}`,
    details: {
      disputeId: dispute.id,
      amount: dispute.amount,
      status: dispute.status,
    },
    source: 'stripe_webhook',
  })

  logger.info('Dispute closed', {
    disputeId: dispute.id,
    status: dispute.status,
  })

  return { success: true, message: 'Dispute closure recorded' }
}

// =============================================================================
// CUSTOMER HANDLERS
// =============================================================================

async function handleCustomerCreated(customer: Stripe.Customer): Promise<WebhookResult> {
  logger.info('Customer created in Stripe', {
    customerId: customer.id,
    email: customer.email,
  })

  // Optionally sync to our users table
  // This would link the Stripe customer ID to our user record

  return { success: true, message: 'Customer creation logged' }
}
