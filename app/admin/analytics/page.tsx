"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Download, TrendingUp, Users, Clock, Zap, DollarSign, Gift, MapPin } from "lucide-react"

const revenueData = [
  { date: "Mon", revenue: 1240, rentals: 62 },
  { date: "Tue", revenue: 1580, rentals: 79 },
  { date: "Wed", revenue: 1890, rentals: 94 },
  { date: "Thu", revenue: 2100, rentals: 105 },
  { date: "Fri", revenue: 2850, rentals: 142 },
  { date: "Sat", revenue: 3200, rentals: 160 },
  { date: "Sun", revenue: 2900, rentals: 145 },
]

const hourlyUsage = [
  { hour: "6am", rentals: 12 },
  { hour: "8am", rentals: 45 },
  { hour: "10am", rentals: 78 },
  { hour: "12pm", rentals: 120 },
  { hour: "2pm", rentals: 95 },
  { hour: "4pm", rentals: 85 },
  { hour: "6pm", rentals: 145 },
  { hour: "8pm", rentals: 180 },
  { hour: "10pm", rentals: 130 },
  { hour: "12am", rentals: 45 },
]

const durationDistribution = [
  { name: "< 30 min", value: 15, color: "#e5e7eb" },
  { name: "30-60 min", value: 25, color: "#93c5fd" },
  { name: "1-2 hrs", value: 35, color: "#3b82f6" },
  { name: "2-4 hrs", value: 18, color: "#1d4ed8" },
  { name: "> 4 hrs", value: 7, color: "#1e3a8a" },
]

const stationPerformance = [
  { name: "Main Stage", rentals: 245, revenue: 4900 },
  { name: "Food Court", rentals: 189, revenue: 3780 },
  { name: "VIP Entrance", rentals: 156, revenue: 3120 },
  { name: "East Gate", rentals: 134, revenue: 2680 },
  { name: "Merch Area", rentals: 98, revenue: 1960 },
]

const conversionFunnel = [
  { stage: "QR Scans", value: 1500 },
  { stage: "Info Submitted", value: 1200 },
  { stage: "Payment Started", value: 950 },
  { stage: "Rental Started", value: 890 },
  { stage: "Completed", value: 820 },
  { stage: "Reward Earned", value: 580 },
]

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">Deep dive into platform performance</p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="7d">
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +23%
              </span>
            </div>
            <p className="text-2xl font-semibold text-foreground">$15,760</p>
            <p className="text-xs text-muted-foreground">Total Revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +18%
              </span>
            </div>
            <p className="text-2xl font-semibold text-foreground">787</p>
            <p className="text-xs text-muted-foreground">Total Rentals</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +5%
              </span>
            </div>
            <p className="text-2xl font-semibold text-foreground">1h 42m</p>
            <p className="text-xs text-muted-foreground">Avg Duration</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Gift className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +12%
              </span>
            </div>
            <p className="text-2xl font-semibold text-foreground">65%</p>
            <p className="text-xs text-muted-foreground">Reward Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue & Rentals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Revenue & Rentals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Hourly Usage Pattern */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Hourly Usage Pattern</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyUsage}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="hour" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="rentals" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Duration Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Duration Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={durationDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {durationDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {durationDistribution.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-sm">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-medium ml-auto">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Station Performance */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-medium">Station Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stationPerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis type="category" dataKey="name" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} width={100} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="rentals" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Rentals" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Conversion Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {conversionFunnel.map((stage, index) => {
              const prevValue = index > 0 ? conversionFunnel[index - 1].value : stage.value
              const conversionRate = index > 0 ? ((stage.value / prevValue) * 100).toFixed(1) : 100
              const widthPercent = (stage.value / conversionFunnel[0].value) * 100
              
              return (
                <div key={stage.stage} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{stage.stage}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{stage.value.toLocaleString()}</span>
                      {index > 0 && (
                        <span className="text-xs text-muted-foreground">({conversionRate}%)</span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          
          <div className="mt-6 pt-4 border-t grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-semibold text-foreground">80%</p>
              <p className="text-xs text-muted-foreground">Scan → Info</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-foreground">79%</p>
              <p className="text-xs text-muted-foreground">Info → Payment</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-foreground">94%</p>
              <p className="text-xs text-muted-foreground">Payment → Rental</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-foreground">65%</p>
              <p className="text-xs text-muted-foreground">Completed → Reward</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
