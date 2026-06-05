import { createServiceClient } from '@/lib/supabase/admin'
import type { DbRentalSession, DbReward, DbStation } from '@/lib/db/types'
import type { DashboardStats } from '@/lib/types'

type SessionMetricsRow = Pick<
  DbRentalSession,
  'status' | 'amount_charged' | 'duration_minutes' | 'deposit_amount'
>
type StationMetricsRow = Pick<DbStation, 'status' | 'is_enabled'>
type RewardMetricsRow = Pick<DbReward, 'status' | 'created_at'>
type DailyRevenueRow = Pick<DbRentalSession, 'created_at' | 'amount_charged' | 'status'>

class AnalyticsRepository {
  async getDashboardStats(): Promise<DashboardStats> {
    const supabase = createServiceClient()

    const [sessionsRes, stationsRes, rewardsRes] = await Promise.all([
      supabase.from('rental_sessions').select('status, amount_charged, duration_minutes, deposit_amount'),
      supabase.from('stations').select('status, is_enabled'),
      supabase.from('rewards').select('status'),
    ])

    if (sessionsRes.error) throw sessionsRes.error
    if (stationsRes.error) throw stationsRes.error
    if (rewardsRes.error) throw rewardsRes.error

    const sessions = (sessionsRes.data || []) as SessionMetricsRow[]
    const stations = (stationsRes.data || []) as StationMetricsRow[]
    const rewards = (rewardsRes.data || []) as RewardMetricsRow[]

    const totalSessions = sessions.length
    const activeSessions = sessions.filter((s) => s.status === 'active' || s.status === 'pending').length
    const completed = sessions.filter((s) => s.status === 'completed')
    const totalRevenue = completed.reduce((sum, s) => sum + Number(s.amount_charged ?? 0), 0)
    const totalDuration = completed.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0)
    const averageSessionDuration = completed.length > 0 ? Math.round(totalDuration / completed.length) : 0
    const totalRewardsIssued = rewards.filter((r) => ['issued', 'redeemed', 'qualified'].includes(r.status)).length
    const totalRewardsRedeemed = rewards.filter((r) => r.status === 'redeemed').length
    const stationsTotal = stations.filter((s) => s.is_enabled).length
    const stationsOnline = stations.filter((s) => s.is_enabled && s.status === 'online').length

    return {
      totalSessions,
      activeSessions,
      totalRevenue,
      totalDepositsHeld: sessions
        .filter((s) => s.status === 'active')
        .reduce((sum, s) => sum + Number(s.deposit_amount ?? 0), 0),
      totalRewardsIssued,
      totalRewardsRedeemed,
      averageSessionDuration,
      conversionRate: totalSessions > 0 ? (completed.length / totalSessions) * 100 : 0,
      stationsOnline,
      stationsTotal,
    }
  }

  async getDailyRevenue(days = 14): Promise<{ date: string; revenue: number; sessions: number }[]> {
    const supabase = createServiceClient()
    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data, error } = await supabase
      .from('rental_sessions')
      .select('created_at, amount_charged, status')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })

    if (error) throw error

    const byDay = new Map<string, { revenue: number; sessions: number }>()
    for (const row of (data || []) as DailyRevenueRow[]) {
      const date = row.created_at.slice(0, 10)
      const entry = byDay.get(date) || { revenue: 0, sessions: 0 }
      entry.sessions += 1
      if (row.status === 'completed') {
        entry.revenue += Number(row.amount_charged ?? 0)
      }
      byDay.set(date, entry)
    }

    return Array.from(byDay.entries()).map(([date, v]) => ({
      date,
      revenue: Math.round(v.revenue * 100) / 100,
      sessions: v.sessions,
    }))
  }

  private sinceDate(days: number): string {
    const since = new Date()
    since.setDate(since.getDate() - days)
    return since.toISOString()
  }

  async getRevenueAnalytics(days = 30) {
    const supabase = createServiceClient()
    const since = this.sinceDate(days)
    const { data, error } = await supabase
      .from('rental_sessions')
      .select('created_at, amount_charged, status')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
    if (error) throw error

    const rows = (data || []) as DailyRevenueRow[]
    const byDay = new Map<string, { revenue: number; sessions: number }>()
    let totalRevenue = 0
    let refundTotal = 0

    for (const row of rows) {
      const period = row.created_at.slice(0, 10)
      const entry = byDay.get(period) || { revenue: 0, sessions: 0 }
      entry.sessions += 1
      if (row.status === 'completed') {
        const amount = Number(row.amount_charged ?? 0)
        entry.revenue += amount
        totalRevenue += amount
      }
      if (row.status === 'cancelled') {
        refundTotal += Number(row.amount_charged ?? 0)
      }
      byDay.set(period, entry)
    }

    const revenueByPeriod = Array.from(byDay.entries()).map(([period, v]) => ({
      period,
      revenue: Math.round(v.revenue * 100) / 100,
      sessions: v.sessions,
    }))

    const completed = rows.filter((r) => r.status === 'completed').length
    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      revenueByPeriod,
      averageTransactionValue: completed > 0 ? Math.round((totalRevenue / completed) * 100) / 100 : 0,
      refundTotal: Math.round(refundTotal * 100) / 100,
    }
  }

  async getSessionAnalytics(days = 30) {
    const supabase = createServiceClient()
    const since = this.sinceDate(days)
    const { data, error } = await supabase
      .from('rental_sessions')
      .select('id, status, duration_minutes, created_at, pickup_station_id, pickup_station:stations!pickup_station_id(name)')
      .gte('created_at', since)
    if (error) throw error

    type Row = {
      id: string
      status: string
      duration_minutes: number | null
      created_at: string
      pickup_station_id: string | null
      pickup_station: { name: string } | null
    }
    const rows = (data || []) as Row[]
    const byDay = new Map<string, number>()
    const byStation = new Map<string, { stationName: string; count: number }>()
    let durationSum = 0
    let completedCount = 0

    for (const row of rows) {
      const period = row.created_at.slice(0, 10)
      byDay.set(period, (byDay.get(period) || 0) + 1)
      if (row.status === 'completed') {
        completedCount += 1
        durationSum += row.duration_minutes ?? 0
      }
      if (row.pickup_station_id) {
        const name = row.pickup_station?.name ?? 'Unknown'
        const existing = byStation.get(row.pickup_station_id) || { stationName: name, count: 0 }
        existing.count += 1
        byStation.set(row.pickup_station_id, existing)
      }
    }

    return {
      totalSessions: rows.length,
      activeSessions: rows.filter((r) => r.status === 'active' || r.status === 'pending').length,
      completedSessions: rows.filter((r) => r.status === 'completed').length,
      expiredSessions: rows.filter((r) => r.status === 'expired').length,
      averageDuration: completedCount > 0 ? Math.round(durationSum / completedCount) : 0,
      sessionsByPeriod: Array.from(byDay.entries()).map(([period, count]) => ({ period, count })),
      sessionsByStation: Array.from(byStation.entries()).map(([stationId, v]) => ({
        stationId,
        stationName: v.stationName,
        count: v.count,
      })),
    }
  }

  async getRewardAnalytics(days = 30) {
    const supabase = createServiceClient()
    const since = this.sinceDate(days)
    const { data, error } = await supabase
      .from('rewards')
      .select('status, created_at')
      .gte('created_at', since)
    if (error) throw error

    const rows = (data || []) as RewardMetricsRow[]
    const issued = rows.filter((r) => ['issued', 'redeemed', 'qualified'].includes(r.status)).length
    const redeemed = rows.filter((r) => r.status === 'redeemed').length
    const expired = rows.filter((r) => r.status === 'expired').length
    const byDay = new Map<string, { issued: number; redeemed: number }>()

    for (const row of rows) {
      const period = row.created_at?.slice(0, 10) ?? 'unknown'
      const entry = byDay.get(period) || { issued: 0, redeemed: 0 }
      if (['issued', 'redeemed', 'qualified'].includes(row.status)) entry.issued += 1
      if (row.status === 'redeemed') entry.redeemed += 1
      byDay.set(period, entry)
    }

    return {
      totalIssued: issued,
      totalRedeemed: redeemed,
      totalExpired: expired,
      redemptionRate: issued > 0 ? (redeemed / issued) * 100 : 0,
      rewardsByPeriod: Array.from(byDay.entries()).map(([period, v]) => ({ period, ...v })),
    }
  }

  async getHourlyDistribution(days = 30) {
    const supabase = createServiceClient()
    const since = this.sinceDate(days)
    const { data, error } = await supabase
      .from('rental_sessions')
      .select('created_at')
      .gte('created_at', since)
    if (error) throw error

    const counts = Array.from({ length: 24 }, (_, hour) => ({ hour: `${hour}:00`, count: 0 }))
    for (const row of data || []) {
      const hour = new Date((row as { created_at: string }).created_at).getHours()
      counts[hour].count += 1
    }
    return counts
  }

  async getDurationDistribution(days = 30) {
    const supabase = createServiceClient()
    const since = this.sinceDate(days)
    const { data, error } = await supabase
      .from('rental_sessions')
      .select('duration_minutes')
      .eq('status', 'completed')
      .gte('created_at', since)
    if (error) throw error

    const buckets = [
      { name: '< 30 min', min: 0, max: 30, count: 0 },
      { name: '30-60 min', min: 30, max: 60, count: 0 },
      { name: '1-2 hrs', min: 60, max: 120, count: 0 },
      { name: '2-4 hrs', min: 120, max: 240, count: 0 },
      { name: '> 4 hrs', min: 240, max: Infinity, count: 0 },
    ]

    for (const row of data || []) {
      const mins = (row as { duration_minutes: number | null }).duration_minutes ?? 0
      const bucket = buckets.find((b) => mins >= b.min && mins < b.max)
      if (bucket) bucket.count += 1
    }

    const total = buckets.reduce((sum, b) => sum + b.count, 0) || 1
    const colors = ['#e5e7eb', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a']
    return buckets.map((b, i) => ({
      name: b.name,
      value: Math.round((b.count / total) * 100),
      count: b.count,
      color: colors[i],
    }))
  }

  async getRecentActivity(limit = 8) {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('rental_sessions')
      .select('session_code, status, created_at, updated_at, user:users(email, name), pickup_station:stations!pickup_station_id(name)')
      .order('updated_at', { ascending: false })
      .limit(limit)
    if (error) throw error

    type ActivityRow = {
      session_code: string
      status: string
      created_at: string
      updated_at: string
      user: { email: string; name: string | null } | null
      pickup_station: { name: string } | null
    }

    return ((data || []) as ActivityRow[]).map((r) => {
      const type =
        r.status === 'completed' ? 'return' : r.status === 'active' ? 'rental_start' : 'session'
      return {
        type,
        label:
          r.status === 'completed'
            ? 'Rental completed'
            : r.status === 'active'
              ? 'Rental active'
              : r.status === 'pending'
                ? 'Rental pending'
                : `Session ${r.status}`,
        user: r.user?.email ?? r.user?.name ?? 'Unknown',
        station: r.pickup_station?.name ?? '—',
        time: r.updated_at || r.created_at,
      }
    })
  }

  async getFunnel(): Promise<{ stage: string; count: number }[]> {
    const supabase = createServiceClient()
    const { count: scans } = await supabase.from('rental_sessions').select('*', { count: 'exact', head: true })
    const { count: started } = await supabase
      .from('rental_sessions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active', 'completed'])
    const { count: completed } = await supabase
      .from('rental_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
    const { count: rewarded } = await supabase
      .from('rewards')
      .select('*', { count: 'exact', head: true })

    return [
      { stage: 'Scans / Starts', count: scans ?? 0 },
      { stage: 'Active Rentals', count: started ?? 0 },
      { stage: 'Completed', count: completed ?? 0 },
      { stage: 'Rewards', count: rewarded ?? 0 },
    ]
  }
}

export const analyticsRepository = new AnalyticsRepository()
