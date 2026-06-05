import { Suspense } from 'react'
import { getBillingOverview } from '@/app/actions/billing'
import { formatCurrency } from '@/lib/stripe/types'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { BillingCharts } from './billing-charts'
import { RecentTransactionsTable } from './recent-transactions-table'
import { DisputesAlert } from './disputes-alert'

// Force dynamic rendering - this page requires Stripe API calls
export const dynamic = 'force-dynamic'

// =============================================================================
// BILLING DASHBOARD PAGE
// =============================================================================

export default async function BillingDashboardPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Billing & Payments"
        description="Monitor revenue, transactions, and payment health"
      />

      <Suspense fallback={<BillingDashboardSkeleton />}>
        <BillingDashboardContent />
      </Suspense>
    </div>
  )
}

async function BillingDashboardContent() {
  const report = await getBillingOverview(30)
  const { metrics } = report

  return (
    <>
      {report.disputes.length > 0 && (
        <DisputesAlert disputes={report.disputes} />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Net Revenue"
          value={formatCurrency(metrics.netRevenue)}
          description="Last 30 days"
          trend={metrics.netRevenue > 0 ? 'positive' : 'neutral'}
        />
        <MetricCard
          title="Total Transactions"
          value={metrics.totalTransactions.toString()}
          description={`${metrics.successfulTransactions} successful`}
          trend="neutral"
        />
        <MetricCard
          title="Avg. Transaction"
          value={formatCurrency(metrics.averageTransactionAmount)}
          description="Per rental"
          trend="neutral"
        />
        <MetricCard
          title="Pending Auth"
          value={metrics.authorizedPending.toString()}
          description="Awaiting capture"
          trend={metrics.authorizedPending > 10 ? 'warning' : 'neutral'}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(metrics.totalRevenue)}
          description="Gross revenue"
          trend="neutral"
          variant="secondary"
        />
        <MetricCard
          title="Total Refunds"
          value={formatCurrency(metrics.totalRefunds)}
          description={`${report.disputes.length} disputes`}
          trend={metrics.totalRefunds > 0 ? 'negative' : 'neutral'}
          variant="secondary"
        />
        <MetricCard
          title="Failed Payments"
          value={metrics.failedTransactions.toString()}
          description="Last 30 days"
          trend={metrics.failedTransactions > 5 ? 'negative' : 'neutral'}
          variant="secondary"
        />
      </div>

      <BillingCharts
        revenueByDay={report.revenueByDay}
        revenueByStation={report.revenueByStation}
      />

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>
            Latest payment activity across all stations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecentTransactionsTable transactions={report.recentTransactions} />
        </CardContent>
      </Card>
    </>
  )
}

interface MetricCardProps {
  title: string
  value: string
  description: string
  trend: 'positive' | 'negative' | 'warning' | 'neutral'
  variant?: 'primary' | 'secondary'
}

function MetricCard({ title, value, description, trend, variant = 'primary' }: MetricCardProps) {
  const trendColors = {
    positive: 'text-green-500',
    negative: 'text-red-500',
    warning: 'text-yellow-500',
    neutral: 'text-muted-foreground',
  }

  return (
    <Card className={variant === 'secondary' ? 'bg-muted/50' : ''}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {trend === 'positive' && (
          <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        )}
        {trend === 'negative' && (
          <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        )}
        {trend === 'warning' && (
          <svg className="h-4 w-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className={`text-xs ${trendColors[trend]}`}>
          {description}
        </p>
      </CardContent>
    </Card>
  )
}

function BillingDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-20 bg-muted rounded animate-pulse mb-2" />
              <div className="h-3 w-16 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="h-5 w-32 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="h-5 w-40 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
