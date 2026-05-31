'use client'

import { formatCurrency } from '@/lib/stripe/types'

interface Dispute {
  id: string
  amount: number
  reason: string
  status: string
  createdAt: string
}

interface DisputesAlertProps {
  disputes: Dispute[]
}

export function DisputesAlert({ disputes }: DisputesAlertProps) {
  const openDisputes = disputes.filter(d => 
    ['warning_needs_response', 'warning_under_review', 'needs_response'].includes(d.status)
  )
  
  const totalAmount = openDisputes.reduce((sum, d) => sum + d.amount, 0)

  if (openDisputes.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/20">
          <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-red-600">
            {openDisputes.length} Active Dispute{openDisputes.length > 1 ? 's' : ''} Requiring Attention
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Total disputed amount: {formatCurrency(totalAmount)}
          </p>
          <div className="mt-3 space-y-2">
            {openDisputes.map((dispute) => (
              <div
                key={dispute.id}
                className="flex items-center justify-between rounded bg-background/50 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">{formatCurrency(dispute.amount)}</span>
                  <span className="text-muted-foreground ml-2">
                    {formatDisputeReason(dispute.reason)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(dispute.createdAt).toLocaleDateString()}
                  </span>
                  <a
                    href={`https://dashboard.stripe.com/disputes/${dispute.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    View in Stripe
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatDisputeReason(reason: string): string {
  const reasons: Record<string, string> = {
    duplicate: 'Duplicate charge',
    fraudulent: 'Fraudulent',
    subscription_canceled: 'Subscription canceled',
    product_unacceptable: 'Product unacceptable',
    product_not_received: 'Product not received',
    unrecognized: 'Unrecognized',
    credit_not_processed: 'Credit not processed',
    general: 'General',
    incorrect_account_details: 'Incorrect account details',
    insufficient_funds: 'Insufficient funds',
    bank_cannot_process: 'Bank cannot process',
    debit_not_authorized: 'Debit not authorized',
  }
  return reasons[reason] || reason.replace(/_/g, ' ')
}
