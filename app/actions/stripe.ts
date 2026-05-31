'use server'

import { createCheckoutSession, getOrCreateCustomer, getCheckoutSession } from '@/lib/stripe/payment-service'
import { DEFAULT_PRICING, generateIdempotencyKey } from '@/lib/stripe/types'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/observability/logger'

// =============================================================================
// SERVER ACTIONS FOR STRIPE CHECKOUT
// =============================================================================

export interface StartRentalCheckoutParams {
  email: string
  name?: string
  stationId: string
  slotNumber: number
  campaignId?: string
}

export interface StartRentalCheckoutResult {
  success: boolean
  clientSecret?: string
  sessionCode?: string
  error?: string
}

/**
 * Start the rental checkout flow
 * Creates a rental session and Stripe checkout session with deposit authorization
 */
export async function startRentalCheckout(
  params: StartRentalCheckoutParams
): Promise<StartRentalCheckoutResult> {
  const span = logger.startSpan('actions.startRentalCheckout')
  
  try {
    const supabase = await createClient()
    
    // Get or create Stripe customer
    const customer = await getOrCreateCustomer({
      email: params.email,
      name: params.name,
      metadata: {
        source: 'rental_checkout',
      },
    })

    // Get or create user in our database
    let userId: string
    
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', params.email)
      .single()

    if (existingUser) {
      userId = existingUser.id
    } else {
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          email: params.email,
          name: params.name,
          terms_accepted_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (userError || !newUser) {
        logger.error('Failed to create user', { error: userError, email: params.email })
        return { success: false, error: 'Failed to create user account' }
      }
      
      userId = newUser.id
    }

    // Get campaign pricing if specified
    let depositAmount = DEFAULT_PRICING.depositAmountCents
    let hourlyRate = DEFAULT_PRICING.hourlyRateCents
    
    if (params.campaignId) {
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('deposit_amount, hourly_rate')
        .eq('id', params.campaignId)
        .eq('is_active', true)
        .single()

      if (campaign) {
        depositAmount = Math.round(campaign.deposit_amount * 100)
        hourlyRate = Math.round(campaign.hourly_rate * 100)
      }
    }

    // Generate session code
    const sessionCode = generateSessionCode()

    // Create rental session in database
    const { data: rentalSession, error: sessionError } = await supabase
      .from('rental_sessions')
      .insert({
        session_code: sessionCode,
        user_id: userId,
        campaign_id: params.campaignId || null,
        start_station_id: params.stationId,
        start_slot_number: params.slotNumber,
        hourly_rate: hourlyRate / 100,
        deposit_amount: depositAmount / 100,
        status: 'pending',
        payment_status: 'pending',
        metadata: {
          stripe_customer_id: customer.id,
          checkout_started_at: new Date().toISOString(),
        },
      })
      .select('id')
      .single()

    if (sessionError || !rentalSession) {
      logger.error('Failed to create rental session', { error: sessionError })
      return { success: false, error: 'Failed to create rental session' }
    }

    // Create Stripe checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    
    const checkoutResult = await createCheckoutSession({
      customerId: customer.id,
      customerEmail: params.email,
      sessionId: sessionCode,
      userId,
      stationId: params.stationId,
      slotNumber: params.slotNumber,
      campaignId: params.campaignId,
      depositAmountCents: depositAmount,
      successUrl: `${baseUrl}/rental/success?session=${sessionCode}`,
      cancelUrl: `${baseUrl}/rental/cancel?session=${sessionCode}`,
    })

    logger.info('Rental checkout started', {
      sessionCode,
      stationId: params.stationId,
      slotNumber: params.slotNumber,
      depositAmount,
    })

    return {
      success: true,
      clientSecret: checkoutResult.clientSecret,
      sessionCode,
    }
  } catch (error) {
    logger.error('Error starting rental checkout', { error, params })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start checkout',
    }
  } finally {
    span.end()
  }
}

/**
 * Check the status of a checkout session
 */
export async function getCheckoutStatus(
  sessionCode: string
): Promise<{
  status: 'pending' | 'completed' | 'expired' | 'failed'
  paymentStatus?: string
  error?: string
}> {
  try {
    const supabase = await createClient()
    
    const { data: session, error } = await supabase
      .from('rental_sessions')
      .select('status, payment_status, payment_intent_id, error_message')
      .eq('session_code', sessionCode)
      .single()

    if (error || !session) {
      return { status: 'failed', error: 'Session not found' }
    }

    // Map database status to checkout status
    if (session.status === 'active' || session.payment_status === 'authorized') {
      return { status: 'completed', paymentStatus: session.payment_status }
    }
    
    if (session.status === 'failed' || session.payment_status === 'failed') {
      return { status: 'failed', paymentStatus: session.payment_status, error: session.error_message }
    }
    
    if (session.status === 'cancelled' || session.payment_status === 'expired') {
      return { status: 'expired', paymentStatus: session.payment_status }
    }

    return { status: 'pending', paymentStatus: session.payment_status }
  } catch (error) {
    logger.error('Error getting checkout status', { error, sessionCode })
    return { status: 'failed', error: 'Failed to get checkout status' }
  }
}

/**
 * Cancel a pending checkout session
 */
export async function cancelCheckout(
  sessionCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('rental_sessions')
      .update({
        status: 'cancelled',
        payment_status: 'canceled',
        metadata: {
          canceled_at: new Date().toISOString(),
          canceled_by: 'user',
        },
      })
      .eq('session_code', sessionCode)
      .eq('status', 'pending')

    if (error) {
      return { success: false, error: 'Failed to cancel checkout' }
    }

    logger.info('Checkout canceled', { sessionCode })
    return { success: true }
  } catch (error) {
    logger.error('Error canceling checkout', { error, sessionCode })
    return { success: false, error: 'Failed to cancel checkout' }
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
