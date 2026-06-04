import { createServiceClient } from '@/lib/supabase/admin'
import type { DbRentalSession, DbReward, DbStation } from '@/lib/db/types'
import type { DashboardStats } from '@/lib/types'

type SessionMetricsRow = Pick<
  DbRentalSession,
  'status' | 'amount_charged' | 'duration_minutes' | 'deposit_amount'
>
type StationMetricsRow = Pick<DbStation, 'status' | 'is_enabled'>
type RewardMetricsRow = Pick<DbReward, 'status'>
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
