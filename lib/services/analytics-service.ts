// Analytics service - handles all analytics and reporting operations
// Production implementation using Supabase

import type { DashboardStats } from '@/lib/types';
import type { 
  ApiResponse, 
  AnalyticsDateRange,
  RevenueAnalytics,
  SessionAnalytics,
  RewardAnalytics,
  FunnelAnalytics,
} from '@/lib/api/types';
import { 
  createSuccessResponse,
  createErrorResponse,
  ErrorCodes,
} from '@/lib/api/client';
import { createClient } from '@/lib/supabase/client';

// Analytics service interface
export interface IAnalyticsService {
  getDashboardStats(): Promise<ApiResponse<DashboardStats>>;
  getRevenueAnalytics(dateRange?: AnalyticsDateRange): Promise<ApiResponse<RevenueAnalytics>>;
  getSessionAnalytics(dateRange?: AnalyticsDateRange): Promise<ApiResponse<SessionAnalytics>>;
  getRewardAnalytics(dateRange?: AnalyticsDateRange): Promise<ApiResponse<RewardAnalytics>>;
  getFunnelAnalytics(campaignId?: string): Promise<ApiResponse<FunnelAnalytics>>;
  getHourlyDistribution(dateRange?: AnalyticsDateRange): Promise<ApiResponse<{ hour: string; count: number }[]>>;
  getDailyRevenue(dateRange?: AnalyticsDateRange): Promise<ApiResponse<{ date: string; revenue: number; sessions: number }[]>>;
}

// Production implementation using Supabase
class SupabaseAnalyticsService implements IAnalyticsService {
  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    try {
      const supabase = createClient();
      
      // Get all stats in parallel
      const [
        sessionsResult,
        activeSessionsResult,
        stationsResult,
        onlineStationsResult,
        rewardsResult,
        redeemedRewardsResult,
        usersResult,
      ] = await Promise.all([
        supabase.from('rental_sessions').select('total_charge, duration_minutes', { count: 'exact' }),
        supabase.from('rental_sessions').select('id', { count: 'exact', head: true }).in('status', ['pending', 'active']),
        supabase.from('stations').select('id', { count: 'exact', head: true }),
        supabase.from('stations').select('id', { count: 'exact', head: true }).eq('status', 'online'),
        supabase.from('rewards').select('id', { count: 'exact', head: true }),
        supabase.from('rewards').select('id', { count: 'exact', head: true }).eq('status', 'redeemed'),
        supabase.from('users').select('id', { count: 'exact', head: true }),
      ]);

      const sessions = sessionsResult.data || [];
      const totalRevenue = sessions.reduce((sum, s) => sum + Number(s.total_charge || 0), 0);
      const totalDuration = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
      const avgDuration = sessions.length > 0 ? Math.round(totalDuration / sessions.length) : 0;

      const stats: DashboardStats = {
        totalRevenue,
        totalSessions: sessionsResult.count || 0,
        activeSessions: activeSessionsResult.count || 0,
        totalStations: stationsResult.count || 0,
        onlineStations: onlineStationsResult.count || 0,
        averageSessionDuration: avgDuration,
        totalRewardsIssued: rewardsResult.count || 0,
        totalRewardsRedeemed: redeemedRewardsResult.count || 0,
        totalUsers: usersResult.count || 0,
      };

      return createSuccessResponse(stats);
    } catch (err) {
      console.error('[AnalyticsService] Error fetching dashboard stats:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch dashboard stats');
    }
  }

  async getRevenueAnalytics(dateRange?: AnalyticsDateRange): Promise<ApiResponse<RevenueAnalytics>> {
    try {
      const supabase = createClient();
      
      let query = supabase
        .from('rental_sessions')
        .select('total_charge, refund_amount, created_at')
        .eq('status', 'completed');

      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('[AnalyticsService] Error fetching revenue analytics:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch revenue analytics');
      }

      const sessions = data || [];
      const totalRevenue = sessions.reduce((sum, s) => sum + Number(s.total_charge || 0), 0);
      const refundTotal = sessions.reduce((sum, s) => sum + Number(s.refund_amount || 0), 0);

      // Group by date
      const revenueByDate = new Map<string, { revenue: number; sessions: number }>();
      sessions.forEach(s => {
        const date = new Date(s.created_at).toISOString().split('T')[0];
        const existing = revenueByDate.get(date) || { revenue: 0, sessions: 0 };
        revenueByDate.set(date, {
          revenue: existing.revenue + Number(s.total_charge || 0),
          sessions: existing.sessions + 1,
        });
      });

      const revenueByPeriod = Array.from(revenueByDate.entries())
        .map(([period, data]) => ({ period, ...data }))
        .sort((a, b) => a.period.localeCompare(b.period));

      const analytics: RevenueAnalytics = {
        totalRevenue,
        revenueByPeriod,
        averageTransactionValue: sessions.length > 0 ? totalRevenue / sessions.length : 0,
        refundTotal,
      };

      return createSuccessResponse(analytics);
    } catch (err) {
      console.error('[AnalyticsService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getSessionAnalytics(dateRange?: AnalyticsDateRange): Promise<ApiResponse<SessionAnalytics>> {
    try {
      const supabase = createClient();
      
      let query = supabase
        .from('rental_sessions')
        .select(`
          id,
          status,
          duration_minutes,
          created_at,
          start_station_id,
          stations:start_station_id(name)
        `);

      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('[AnalyticsService] Error fetching session analytics:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch session analytics');
      }

      const sessions = data || [];
      const completedSessions = sessions.filter(s => s.status === 'completed');
      const activeSessions = sessions.filter(s => s.status === 'active' || s.status === 'pending');
      const expiredSessions = sessions.filter(s => s.status === 'expired' || s.status === 'cancelled');
      
      const totalDuration = completedSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
      const avgDuration = completedSessions.length > 0 ? Math.round(totalDuration / completedSessions.length) : 0;

      // Group by date
      const sessionsByDate = new Map<string, number>();
      sessions.forEach(s => {
        const date = new Date(s.created_at).toISOString().split('T')[0];
        sessionsByDate.set(date, (sessionsByDate.get(date) || 0) + 1);
      });

      // Group by station
      const sessionsByStationMap = new Map<string, { name: string; count: number }>();
      sessions.forEach(s => {
        const stationId = s.start_station_id;
        const stationName = (s.stations as { name: string } | null)?.name || 'Unknown';
        const existing = sessionsByStationMap.get(stationId) || { name: stationName, count: 0 };
        sessionsByStationMap.set(stationId, { name: existing.name, count: existing.count + 1 });
      });

      const analytics: SessionAnalytics = {
        totalSessions: sessions.length,
        activeSessions: activeSessions.length,
        completedSessions: completedSessions.length,
        expiredSessions: expiredSessions.length,
        averageDuration: avgDuration,
        sessionsByPeriod: Array.from(sessionsByDate.entries())
          .map(([period, count]) => ({ period, count }))
          .sort((a, b) => a.period.localeCompare(b.period)),
        sessionsByStation: Array.from(sessionsByStationMap.entries())
          .map(([stationId, data]) => ({ stationId, stationName: data.name, count: data.count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      };

      return createSuccessResponse(analytics);
    } catch (err) {
      console.error('[AnalyticsService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getRewardAnalytics(dateRange?: AnalyticsDateRange): Promise<ApiResponse<RewardAnalytics>> {
    try {
      const supabase = createClient();
      
      let query = supabase
        .from('rewards')
        .select('id, status, created_at, claimed_at');

      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('[AnalyticsService] Error fetching reward analytics:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch reward analytics');
      }

      const rewards = data || [];
      const totalIssued = rewards.length;
      const totalRedeemed = rewards.filter(r => r.status === 'redeemed').length;
      const totalExpired = rewards.filter(r => r.status === 'expired').length;
      const redemptionRate = totalIssued > 0 ? (totalRedeemed / totalIssued) * 100 : 0;

      // Group by date
      const rewardsByDate = new Map<string, { issued: number; redeemed: number }>();
      rewards.forEach(r => {
        const date = new Date(r.created_at).toISOString().split('T')[0];
        const existing = rewardsByDate.get(date) || { issued: 0, redeemed: 0 };
        rewardsByDate.set(date, {
          issued: existing.issued + 1,
          redeemed: existing.redeemed + (r.status === 'redeemed' ? 1 : 0),
        });
      });

      const analytics: RewardAnalytics = {
        totalIssued,
        totalRedeemed,
        totalExpired,
        redemptionRate,
        rewardsByPeriod: Array.from(rewardsByDate.entries())
          .map(([period, data]) => ({ period, ...data }))
          .sort((a, b) => a.period.localeCompare(b.period)),
      };

      return createSuccessResponse(analytics);
    } catch (err) {
      console.error('[AnalyticsService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getFunnelAnalytics(campaignId?: string): Promise<ApiResponse<FunnelAnalytics>> {
    try {
      const supabase = createClient();
      
      // Get counts for each stage
      let sessionsQuery = supabase.from('rental_sessions').select('id, status', { count: 'exact' });
      let rewardsQuery = supabase.from('rewards').select('id, status', { count: 'exact' });

      if (campaignId) {
        sessionsQuery = sessionsQuery.eq('campaign_id', campaignId);
        rewardsQuery = rewardsQuery.eq('campaign_id', campaignId);
      }

      const [sessionsResult, rewardsResult] = await Promise.all([sessionsQuery, rewardsQuery]);

      const sessions = sessionsResult.data || [];
      const rewards = rewardsResult.data || [];

      const totalScans = sessions.length; // All sessions started with a scan
      const totalAuthenticated = sessions.length; // All sessions are authenticated
      const totalPaid = sessions.filter(s => s.status !== 'pending').length;
      const totalCompleted = sessions.filter(s => s.status === 'completed').length;
      const totalRewardsQualified = rewards.filter(r => r.status !== 'pending').length;
      const totalRewardsRedeemed = rewards.filter(r => r.status === 'redeemed').length;

      const stages = [
        { stage: 'QR Scanned', count: totalScans, conversionRate: 100 },
        { stage: 'Authenticated', count: totalAuthenticated, conversionRate: totalScans > 0 ? (totalAuthenticated / totalScans) * 100 : 0 },
        { stage: 'Payment Complete', count: totalPaid, conversionRate: totalAuthenticated > 0 ? (totalPaid / totalAuthenticated) * 100 : 0 },
        { stage: 'Rental Complete', count: totalCompleted, conversionRate: totalPaid > 0 ? (totalCompleted / totalPaid) * 100 : 0 },
        { stage: 'Reward Qualified', count: totalRewardsQualified, conversionRate: totalCompleted > 0 ? (totalRewardsQualified / totalCompleted) * 100 : 0 },
        { stage: 'Reward Redeemed', count: totalRewardsRedeemed, conversionRate: totalRewardsQualified > 0 ? (totalRewardsRedeemed / totalRewardsQualified) * 100 : 0 },
      ];

      const analytics: FunnelAnalytics = {
        stages,
        overallConversion: totalScans > 0 ? (totalRewardsRedeemed / totalScans) * 100 : 0,
      };

      return createSuccessResponse(analytics);
    } catch (err) {
      console.error('[AnalyticsService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getHourlyDistribution(dateRange?: AnalyticsDateRange): Promise<ApiResponse<{ hour: string; count: number }[]>> {
    try {
      const supabase = createClient();
      
      let query = supabase.from('rental_sessions').select('created_at');

      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('[AnalyticsService] Error fetching hourly distribution:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch hourly distribution');
      }

      // Initialize all hours
      const hourCounts = new Map<string, number>();
      for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, '0') + ':00';
        hourCounts.set(hour, 0);
      }

      // Count sessions by hour
      (data || []).forEach(s => {
        const hour = new Date(s.created_at).getHours().toString().padStart(2, '0') + ':00';
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      });

      const distribution = Array.from(hourCounts.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour.localeCompare(b.hour));

      return createSuccessResponse(distribution);
    } catch (err) {
      console.error('[AnalyticsService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getDailyRevenue(dateRange?: AnalyticsDateRange): Promise<ApiResponse<{ date: string; revenue: number; sessions: number }[]>> {
    try {
      const supabase = createClient();
      
      let query = supabase
        .from('rental_sessions')
        .select('total_charge, created_at')
        .eq('status', 'completed');

      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('[AnalyticsService] Error fetching daily revenue:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch daily revenue');
      }

      // Group by date
      const dailyData = new Map<string, { revenue: number; sessions: number }>();
      (data || []).forEach(s => {
        const date = new Date(s.created_at).toISOString().split('T')[0];
        const existing = dailyData.get(date) || { revenue: 0, sessions: 0 };
        dailyData.set(date, {
          revenue: existing.revenue + Number(s.total_charge || 0),
          sessions: existing.sessions + 1,
        });
      });

      const result = Array.from(dailyData.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return createSuccessResponse(result);
    } catch (err) {
      console.error('[AnalyticsService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }
}

// Export singleton instance - now using real Supabase implementation
export const analyticsService: IAnalyticsService = new SupabaseAnalyticsService();
