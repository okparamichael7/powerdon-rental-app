// Analytics service - handles all analytics and reporting operations
// Mock implementation with interface ready for real backend

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
  simulateNetworkDelay, 
  createSuccessResponse,
} from '@/lib/api/client';
import { 
  mockDashboardStats, 
  mockFunnelData, 
  mockRevenueByDay, 
  mockSessionsByHour 
} from '@/lib/mock-data';

// Analytics service interface
export interface IAnalyticsService {
  getDashboardStats(): Promise<ApiResponse<DashboardStats>>;
  getRevenueAnalytics(dateRange?: AnalyticsDateRange): Promise<ApiResponse<RevenueAnalytics>>;
  getSessionAnalytics(dateRange?: AnalyticsDateRange): Promise<ApiResponse<SessionAnalytics>>;
  getRewardAnalytics(dateRange?: AnalyticsDateRange): Promise<ApiResponse<RewardAnalytics>>;
  getFunnelAnalytics(campaignId?: string): Promise<ApiResponse<FunnelAnalytics>>;
  getHourlyDistribution(dateRange?: AnalyticsDateRange): Promise<ApiResponse<{ hour: string; count: number }[]>>;
  getDailyRevenue(dateRange?: AnalyticsDateRange): Promise<ApiResponse<{ date: string; revenue: number; sessions: number }[]>>;
  getDurationDistribution(dateRange?: AnalyticsDateRange): Promise<ApiResponse<{ name: string; value: number; count: number; color: string }[]>>;
  getRecentActivity(): Promise<ApiResponse<{ type: string; label: string; user: string; station: string; time: string }[]>>;
}

// Mock implementation
class MockAnalyticsService implements IAnalyticsService {
  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    await simulateNetworkDelay();
    return createSuccessResponse(mockDashboardStats);
  }

  async getRevenueAnalytics(dateRange?: AnalyticsDateRange): Promise<ApiResponse<RevenueAnalytics>> {
    await simulateNetworkDelay();

    const analytics: RevenueAnalytics = {
      totalRevenue: mockDashboardStats.totalRevenue,
      revenueByPeriod: mockRevenueByDay.map(d => ({
        period: d.date,
        revenue: d.revenue,
        sessions: d.sessions,
      })),
      averageTransactionValue: mockDashboardStats.totalRevenue / mockDashboardStats.totalSessions,
      refundTotal: 4250.00,
    };

    return createSuccessResponse(analytics);
  }

  async getSessionAnalytics(dateRange?: AnalyticsDateRange): Promise<ApiResponse<SessionAnalytics>> {
    await simulateNetworkDelay();

    const analytics: SessionAnalytics = {
      totalSessions: mockDashboardStats.totalSessions,
      activeSessions: mockDashboardStats.activeSessions,
      completedSessions: 1724,
      expiredSessions: 100,
      averageDuration: mockDashboardStats.averageSessionDuration,
      sessionsByPeriod: mockRevenueByDay.map(d => ({
        period: d.date,
        count: d.sessions,
      })),
      sessionsByStation: [
        { stationId: 'STN-A12', stationName: 'Main Stage Hub', count: 645 },
        { stationId: 'STN-B07', stationName: 'Food Court Station', count: 512 },
        { stationId: 'STN-C03', stationName: 'VIP Lounge', count: 234 },
        { stationId: 'STN-D15', stationName: 'Park City Main Hub', count: 356 },
      ],
    };

    return createSuccessResponse(analytics);
  }

  async getRewardAnalytics(dateRange?: AnalyticsDateRange): Promise<ApiResponse<RewardAnalytics>> {
    await simulateNetworkDelay();

    const analytics: RewardAnalytics = {
      totalIssued: mockDashboardStats.totalRewardsIssued,
      totalRedeemed: mockDashboardStats.totalRewardsRedeemed,
      totalExpired: 158,
      redemptionRate: (mockDashboardStats.totalRewardsRedeemed / mockDashboardStats.totalRewardsIssued) * 100,
      rewardsByPeriod: [
        { period: 'Mon', issued: 98, redeemed: 67 },
        { period: 'Tue', issued: 124, redeemed: 89 },
        { period: 'Wed', issued: 156, redeemed: 112 },
        { period: 'Thu', issued: 198, redeemed: 145 },
        { period: 'Fri', issued: 178, redeemed: 134 },
        { period: 'Sat', issued: 89, redeemed: 56 },
        { period: 'Sun', issued: 49, redeemed: 31 },
      ],
    };

    return createSuccessResponse(analytics);
  }

  async getFunnelAnalytics(campaignId?: string): Promise<ApiResponse<FunnelAnalytics>> {
    await simulateNetworkDelay();

    const stages = mockFunnelData.map((stage, index) => ({
      stage: stage.stage,
      count: stage.count,
      conversionRate: index === 0 ? 100 : (stage.count / mockFunnelData[index - 1].count) * 100,
    }));

    const analytics: FunnelAnalytics = {
      stages,
      overallConversion: (mockFunnelData[mockFunnelData.length - 1].count / mockFunnelData[0].count) * 100,
    };

    return createSuccessResponse(analytics);
  }

  async getHourlyDistribution(dateRange?: AnalyticsDateRange): Promise<ApiResponse<{ hour: string; count: number }[]>> {
    await simulateNetworkDelay();

    const distribution = mockSessionsByHour.map(h => ({
      hour: h.hour,
      count: h.sessions,
    }));

    return createSuccessResponse(distribution);
  }

  async getDailyRevenue(dateRange?: AnalyticsDateRange): Promise<ApiResponse<{ date: string; revenue: number; sessions: number }[]>> {
    await simulateNetworkDelay();

    return createSuccessResponse(mockRevenueByDay.map(d => ({
      date: d.date,
      revenue: d.revenue,
      sessions: d.sessions,
    })));
  }

  async getDurationDistribution(): Promise<ApiResponse<{ name: string; value: number; count: number; color: string }[]>> {
    await simulateNetworkDelay();
    return createSuccessResponse([]);
  }

  async getRecentActivity(): Promise<ApiResponse<{ type: string; label: string; user: string; station: string; time: string }[]>> {
    await simulateNetworkDelay();
    return createSuccessResponse([]);
  }
}

// Export singleton instance
export const analyticsService: IAnalyticsService = new MockAnalyticsService();
