// Reward service - handles all reward/voucher operations
// Mock implementation with interface ready for real backend

import type { Reward } from '@/lib/types';
import type { 
  ApiResponse, 
  RewardFilters,
  RedeemRewardRequest,
  RedeemRewardResponse,
} from '@/lib/api/types';
import { 
  simulateNetworkDelay, 
  createSuccessResponse, 
  createErrorResponse,
  ErrorCodes,
  generateId,
  generateRewardCode,
} from '@/lib/api/client';
import { mockRewards } from '@/lib/mock-data';

// Reward service interface
export interface IRewardService {
  getRewards(filters?: RewardFilters): Promise<ApiResponse<Reward[]>>;
  getRewardById(id: string): Promise<ApiResponse<Reward>>;
  getRewardByCode(code: string): Promise<ApiResponse<Reward>>;
  getRewardsByUser(userEmail: string): Promise<ApiResponse<Reward[]>>;
  getRewardsBySession(sessionId: string): Promise<ApiResponse<Reward[]>>;
  issueReward(sessionId: string, campaignId: string): Promise<ApiResponse<Reward>>;
  redeemReward(request: RedeemRewardRequest): Promise<ApiResponse<RedeemRewardResponse>>;
  getRewardStats(): Promise<ApiResponse<{
    totalIssued: number;
    totalRedeemed: number;
    totalExpired: number;
    pendingRedemption: number;
  }>>;
}

// In-memory reward store
let rewards: Reward[] = [...mockRewards];

// Mock implementation
class MockRewardService implements IRewardService {
  async getRewards(filters?: RewardFilters): Promise<ApiResponse<Reward[]>> {
    await simulateNetworkDelay();

    let result = [...rewards];

    // Apply filters
    if (filters?.status && filters.status.length > 0) {
      result = result.filter(r => filters.status!.includes(r.status));
    }

    if (filters?.campaignId) {
      result = result.filter(r => r.campaignId === filters.campaignId);
    }

    if (filters?.userId) {
      result = result.filter(r => r.userId === filters.userId);
    }

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(r => 
        r.code.toLowerCase().includes(search) || 
        r.userEmail.toLowerCase().includes(search) ||
        r.campaignName.toLowerCase().includes(search)
      );
    }

    if (filters?.dateRange) {
      if (filters.dateRange.from) {
        result = result.filter(r => r.issuedAt >= filters.dateRange!.from!);
      }
      if (filters.dateRange.to) {
        result = result.filter(r => r.issuedAt <= filters.dateRange!.to!);
      }
    }

    // Sort by issued date (newest first)
    result.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());

    // Apply pagination
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const start = (page - 1) * limit;
    const paginated = result.slice(start, start + limit);

    return createSuccessResponse(paginated, {
      page,
      limit,
      total: result.length,
    });
  }

  async getRewardById(id: string): Promise<ApiResponse<Reward>> {
    await simulateNetworkDelay();

    const reward = rewards.find(r => r.id === id);
    
    if (!reward) {
      return createErrorResponse(
        ErrorCodes.REWARD_NOT_FOUND,
        `Reward ${id} not found`
      );
    }

    return createSuccessResponse(reward);
  }

  async getRewardByCode(code: string): Promise<ApiResponse<Reward>> {
    await simulateNetworkDelay();

    const reward = rewards.find(r => r.code === code);
    
    if (!reward) {
      return createErrorResponse(
        ErrorCodes.REWARD_NOT_FOUND,
        `Reward with code ${code} not found`
      );
    }

    return createSuccessResponse(reward);
  }

  async getRewardsByUser(userEmail: string): Promise<ApiResponse<Reward[]>> {
    await simulateNetworkDelay();

    const userRewards = rewards.filter(r => r.userEmail === userEmail);
    
    // Sort by issued date (newest first)
    userRewards.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());

    return createSuccessResponse(userRewards);
  }

  async getRewardsBySession(sessionId: string): Promise<ApiResponse<Reward[]>> {
    await simulateNetworkDelay();

    const sessionRewards = rewards.filter(r => r.sessionId === sessionId);
    
    return createSuccessResponse(sessionRewards);
  }

  async issueReward(sessionId: string, campaignId: string): Promise<ApiResponse<Reward>> {
    await simulateNetworkDelay();

    // Check if reward already exists for this session
    const existingReward = rewards.find(r => r.sessionId === sessionId);
    if (existingReward) {
      return createSuccessResponse(existingReward);
    }

    const newReward: Reward = {
      id: generateId('RWD'),
      code: generateRewardCode('POWERDON'),
      sessionId,
      userId: generateId('USR'),
      userEmail: 'user@example.com', // Would come from session
      campaignId,
      campaignName: 'Sundance Merch Reward',
      type: 'voucher',
      value: 10.00,
      description: '€10 voucher for Sundance official merchandise',
      status: 'issued',
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    rewards.unshift(newReward);

    return createSuccessResponse(newReward);
  }

  async redeemReward(request: RedeemRewardRequest): Promise<ApiResponse<RedeemRewardResponse>> {
    await simulateNetworkDelay();

    const rewardIndex = rewards.findIndex(r => r.id === request.rewardId);
    
    if (rewardIndex === -1) {
      return createErrorResponse(
        ErrorCodes.REWARD_NOT_FOUND,
        'Reward not found'
      );
    }

    const reward = rewards[rewardIndex];

    // Validate reward code
    if (reward.code !== request.rewardCode) {
      return createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Invalid reward code'
      );
    }

    // Check if already redeemed
    if (reward.status === 'redeemed') {
      return createErrorResponse(
        ErrorCodes.REWARD_ALREADY_REDEEMED,
        'This reward has already been redeemed'
      );
    }

    // Check if expired
    if (reward.expiresAt < new Date()) {
      rewards[rewardIndex] = { ...reward, status: 'expired' };
      return createErrorResponse(
        ErrorCodes.REWARD_EXPIRED,
        'This reward has expired'
      );
    }

    // Redeem the reward
    const redeemedAt = new Date();
    rewards[rewardIndex] = {
      ...reward,
      status: 'redeemed',
      redeemedAt,
      redemptionLocation: request.redemptionLocation,
    };

    return createSuccessResponse({
      success: true,
      rewardId: reward.id,
      value: reward.value,
      type: reward.type,
      redeemedAt,
    });
  }

  async getRewardStats(): Promise<ApiResponse<{
    totalIssued: number;
    totalRedeemed: number;
    totalExpired: number;
    pendingRedemption: number;
  }>> {
    await simulateNetworkDelay();

    const stats = {
      totalIssued: rewards.length,
      totalRedeemed: rewards.filter(r => r.status === 'redeemed').length,
      totalExpired: rewards.filter(r => r.status === 'expired').length,
      pendingRedemption: rewards.filter(r => r.status === 'issued').length,
    };

    return createSuccessResponse(stats);
  }
}

// Export singleton instance
export const rewardService: IRewardService = new MockRewardService();
