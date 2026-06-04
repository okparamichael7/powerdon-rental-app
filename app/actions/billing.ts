'use server'

import { getPaymentIntentsForReport, getRefundsForReport, getDisputes } from '@/lib/stripe/payment-service'
import { createServiceClient } from '@/lib/supabase/admin'
import type { DbRentalSession } from '@/lib/db/types'
import { logger } from '@/lib/observability/logger'
import { formatCurrency } from '@/lib/stripe/types'

// =============================================================================
// BILLING REPORT TYPES
// =============================================================================

export interface BillingMetrics {
  totalRevenue: number
  totalRefunds: number
  netRevenue: number
  totalTransactions: number
  successfulTransactions: number
  failedTransactions: number
  authorizedPending: number
  averageTransactionAmount: number
  disputeCount: number
  disputeAmount: number
}

export interface RecentTransaction {
  id: string
  sessionCode: string
  customerEmail: string
  amount: number
  status: string
  type: string
  createdAt: string
  stationName?: string
}

export interface RevenueByDay {
  date: string
  revenue: number
  refunds: number
  transactions: number
}

export interface RevenueByStation {
  stationId: string
  stationName: string
  revenue: number
  transactions: number
}

export interface BillingReport {
  metrics: BillingMetrics
  recentTransactions: RecentTransaction[]
  revenueByDay: RevenueByDay[]
  revenueByStation: RevenueByStation[]
  disputes: Array<{
    id: string
    amount: number
    reason: string
    status: string
    createdAt: string
  }>
}

// =============================================================================
// BILLING REPORT ACTIONS
// =============================================================================

/**
 * Get billing overview for admin dashboard
 */
export async function getBillingOverview(
  days: number = 30
): Promise<BillingReport> {
  const span = logger.startSpan('actions.getBillingOverview')
  
  try {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Fetch data in parallel
    const [paymentIntents, refunds, disputes, dbMetrics] = await Promise.all([
      getPaymentIntentsForReport(startDate, endDate, 500),
      getRefundsForReport(startDate, endDate, 500),
      getDisputes(100),
      getDatabaseMetrics(startDate, endDate),
    ])

    // Calculate metrics from Stripe data
    let totalRevenue = 0
    let totalRefunds = 0
    let successfulTransactions = 0
    let failedTransactions = 0
    let authorizedPending = 0

    const revenueByDayMap = new Map<string, { revenue: number; refunds: number; transactions: number }>()
    const recentTransactions: RecentTransaction[] = []

    for (const pi of paymentIntents) {
      const date = new Date(pi.created * 1000).toISOString().split('T')[0]
      
      // Initialize day entry if not exists
      if (!revenueByDayMap.has(date)) {
        revenueByDayMap.set(date, { revenue: 0, refunds: 0, transactions: 0 })
      }
      const dayData = revenueByDayMap.get(date)!

      if (pi.status === 'succeeded') {
        totalRevenue += pi.amount_received
        successfulTransactions++
        dayData.revenue += pi.amount_received
        dayData.transactions++
      } else if (pi.status === 'requires_capture') {
        authorizedPending++
      } else if (pi.status === 'canceled') {
        failedTransactions++
      }

      // Add to recent transactions (limit to 50)
      if (recentTransactions.length < 50) {
        recentTransactions.push({
          id: pi.id,
          sessionCode: pi.metadata.session_id || 'N/A',
          customerEmail: pi.receipt_email || 'N/A',
          amount: pi.amount_received || pi.amount,
          status: pi.status,
          type: pi.metadata.type || 'rental_deposit',
          createdAt: new Date(pi.created * 1000).toISOString(),
        })
      }
    }

    // Process refunds
    for (const refund of refunds) {
      totalRefunds += refund.amount
      
      const date = new Date(refund.created * 1000).toISOString().split('T')[0]
      if (revenueByDayMap.has(date)) {
        revenueByDayMap.get(date)!.refunds += refund.amount
      }
    }

    // Process disputes
    let disputeAmount = 0
    const processedDisputes = disputes
      .filter(d => new Date(d.created * 1000) >= startDate)
      .map(d => {
        disputeAmount += d.amount
        return {
          id: d.id,
          amount: d.amount,
          reason: d.reason,
          status: d.status,
          createdAt: new Date(d.created * 1000).toISOString(),
        }
      })

    // Convert maps to arrays
    const revenueByDay = Array.from(revenueByDayMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const netRevenue = totalRevenue - totalRefunds

    const metrics: BillingMetrics = {
      totalRevenue,
      totalRefunds,
      netRevenue,
      totalTransactions: paymentIntents.length,
      successfulTransactions,
      failedTransactions,
      authorizedPending,
      averageTransactionAmount: successfulTransactions > 0 ? totalRevenue / successfulTransactions : 0,
      disputeCount: processedDisputes.length,
      disputeAmount,
    }

    return {
      metrics,
      recentTransactions,
      revenueByDay,
      revenueByStation: dbMetrics.revenueByStation,
      disputes: processedDisputes,
    }
  } catch (error) {
    logger.error('Error getting billing overview', { error: error instanceof Error ? error : String(error) })
    throw error
  } finally {
    span.end()
  }
}

/**
 * Get database-side metrics (joins with rental_sessions and stations)
 */
async function getDatabaseMetrics(startDate: Date, endDate: Date): Promise<{
  revenueByStation: RevenueByStation[]
}> {
  try {
    const supabase = await createServiceClient()
    
    // Get revenue by station
    const { data: stationRevenue } = await supabase
      .from('rental_sessions')
      .select(`
        pickup_station_id,
        amount_charged,
        pickup_station:stations!pickup_station_id(id, name)
      `)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .eq('status', 'completed')

    const stationMap = new Map<string, { name: string; revenue: number; transactions: number }>()
    
    for (const session of (stationRevenue || []) as Array<{
      pickup_station_id: string
      amount_charged: number | null
      pickup_station: { id: string; name: string } | null
    }>) {
      const stationId = session.pickup_station_id
      const stationName = session.pickup_station?.name || 'Unknown'
      const charge = Number(session.amount_charged) || 0
      
      if (!stationMap.has(stationId)) {
        stationMap.set(stationId, { name: stationName, revenue: 0, transactions: 0 })
      }
      
      const station = stationMap.get(stationId)!
      station.revenue += Math.round(charge * 100) // Convert to cents
      station.transactions++
    }

    const revenueByStation = Array.from(stationMap.entries())
      .map(([stationId, data]) => ({
        stationId,
        stationName: data.name,
        revenue: data.revenue,
        transactions: data.transactions,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    return { revenueByStation }
  } catch (error) {
    logger.error('Error getting database metrics', { error: error instanceof Error ? error : String(error) })
    return { revenueByStation: [] }
  }
}

/**
 * Get payment details for a specific session
 */
export async function getSessionPaymentDetails(sessionCode: string): Promise<{
  session: {
    id: string
    sessionCode: string
    status: string
    paymentStatus: string
    depositAmount: number
    totalCharge: number
    rentalCharge: number
    refundAmount: number
    durationMinutes: number | null
    startedAt: string | null
    endedAt: string | null
  } | null
  paymentIntent: {
    id: string
    amount: number
    amountReceived: number
    status: string
    createdAt: string
  } | null
  error?: string
}> {
  try {
    const supabase = await createServiceClient()
    
    const { data: session, error } = await supabase
      .from('rental_sessions')
      .select('*')
      .eq('session_code', sessionCode)
      .single()

    if (error || !session) {
      return { session: null, paymentIntent: null, error: 'Session not found' }
    }

    const row = session as DbRentalSession

    // Get Stripe payment intent if available
    let paymentIntent = null
    if (row.payment_intent_id) {
      const { getPaymentIntent } = await import('@/lib/stripe/payment-service')
      const pi = await getPaymentIntent(row.payment_intent_id)
      paymentIntent = {
        id: pi.id,
        amount: pi.amount,
        amountReceived: pi.amount_received,
        status: pi.status,
        createdAt: new Date(pi.created * 1000).toISOString(),
      }
    }

    return {
      session: {
        id: row.id,
        sessionCode: row.session_code,
        status: row.status,
        paymentStatus: row.payment_status,
        depositAmount: Math.round(Number(row.deposit_amount) * 100),
        totalCharge: Math.round(Number(row.amount_charged) * 100),
        rentalCharge: Math.round(Number(row.amount_charged) * 100),
        refundAmount: Math.round(Number(row.amount_refunded) * 100),
        durationMinutes: row.duration_minutes,
        startedAt: row.started_at,
        endedAt: row.ended_at,
      },
      paymentIntent,
    }
  } catch (error) {
    logger.error('Error getting session payment details', {
      error: error instanceof Error ? error : String(error),
      sessionCode,
    })
    return { session: null, paymentIntent: null, error: 'Failed to get payment details' }
  }
}

/**
 * Process manual refund for a session
 */
export async function processManualRefund(
  sessionCode: string,
  amountCents: number,
  reason: string
): Promise<{ success: boolean; refundId?: string; error?: string }> {
  try {
    const supabase = await createServiceClient()
    
    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('rental_sessions')
      .select('payment_intent_id, amount_charged')
      .eq('session_code', sessionCode)
      .single()

    const row = session as Pick<DbRentalSession, 'payment_intent_id' | 'amount_charged'> | null

    if (sessionError || !row?.payment_intent_id) {
      return { success: false, error: 'Session or payment not found' }
    }

    // Process refund
    const { createRefund } = await import('@/lib/stripe/payment-service')
    const refund = await createRefund({
      paymentIntentId: row.payment_intent_id,
      amountCents,
      reason: 'requested_by_customer',
      metadata: {
        session_code: sessionCode,
        manual_refund_reason: reason,
        processed_by: 'admin',
      },
    })

    // Update session
    const updatePayload: Partial<DbRentalSession> = {
      amount_refunded: amountCents / 100,
      metadata: {
        refund_id: refund.id,
        refund_processed_at: new Date().toISOString(),
        refund_reason: reason,
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('rental_sessions').update(updatePayload).eq('session_code', sessionCode)

    logger.info('Manual refund processed', {
      sessionCode,
      refundId: refund.id,
      amount: amountCents,
    })

    return { success: true, refundId: refund.id }
  } catch (error) {
    logger.error('Error processing manual refund', {
      error: error instanceof Error ? error : String(error),
      sessionCode,
    })
    return { success: false, error: 'Failed to process refund' }
  }
}

/**
 * Export billing data as CSV
 */
export async function exportBillingCSV(
  startDate: Date,
  endDate: Date
): Promise<{ success: boolean; csv?: string; error?: string }> {
  try {
    const paymentIntents = await getPaymentIntentsForReport(startDate, endDate, 1000)
    
    const headers = [
      'Payment Intent ID',
      'Session Code',
      'Customer Email',
      'Amount',
      'Amount Received',
      'Currency',
      'Status',
      'Type',
      'Created At',
    ]
    
    const rows = paymentIntents.map(pi => [
      pi.id,
      pi.metadata.session_id || '',
      pi.receipt_email || '',
      (pi.amount / 100).toFixed(2),
      (pi.amount_received / 100).toFixed(2),
      pi.currency.toUpperCase(),
      pi.status,
      pi.metadata.type || 'rental_deposit',
      new Date(pi.created * 1000).toISOString(),
    ])
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n')

    return { success: true, csv }
  } catch (error) {
    logger.error('Error exporting billing CSV', { error: error instanceof Error ? error : String(error) })
    return { success: false, error: 'Failed to export billing data' }
  }
}
