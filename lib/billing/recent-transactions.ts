import type Stripe from 'stripe'

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

export function mapPaymentIntentsToRecentTransactions(
  paymentIntents: Stripe.PaymentIntent[],
): RecentTransaction[] {
  return paymentIntents
    .map((pi) => ({
      id: pi.id,
      sessionCode: pi.metadata.session_id || 'N/A',
      customerEmail: pi.receipt_email || 'N/A',
      amount: pi.amount_received || pi.amount,
      status: pi.status,
      type: pi.metadata.type || 'rental_deposit',
      createdAt: new Date(pi.created * 1000).toISOString(),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
