'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts'
import { formatCurrency } from '@/lib/stripe/types'

interface RevenueByDay {
  date: string
  revenue: number
  refunds: number
  transactions: number
}

interface RevenueByStation {
  stationId: string
  stationName: string
  revenue: number
  transactions: number
}

interface BillingChartsProps {
  revenueByDay: RevenueByDay[]
  revenueByStation: RevenueByStation[]
}

export function BillingCharts({ revenueByDay, revenueByStation }: BillingChartsProps) {
  // Format data for charts
  const revenueChartData = revenueByDay.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: d.revenue / 100,
    refunds: d.refunds / 100,
  }))

  const stationChartData = revenueByStation.slice(0, 10).map(s => ({
    name: s.stationName.length > 15 ? s.stationName.substring(0, 15) + '...' : s.stationName,
    revenue: s.revenue / 100,
    transactions: s.transactions,
  }))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Revenue Over Time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatCurrency(Math.round(value * 100))}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload) return null
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-lg">
                        <p className="font-medium">{label}</p>
                        {payload.map((entry, i) => (
                          <p key={i} className="text-sm" style={{ color: entry.color }}>
                            {entry.name}: {formatCurrency(Math.round(Number(entry.value) * 100))}
                          </p>
                        ))}
                      </div>
                    )
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="refunds"
                  name="Refunds"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Revenue by Station */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Stations by Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {stationChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stationChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatCurrency(Math.round(value * 100))}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const data = payload[0].payload
                      return (
                        <div className="rounded-lg border bg-background p-3 shadow-lg">
                          <p className="font-medium">{data.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Revenue: {formatCurrency(Math.round(data.revenue * 100))}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Transactions: {data.transactions}
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No station data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
