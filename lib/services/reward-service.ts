// Reward service - handles all reward/voucher operations
// Production implementation using Supabase

import type { Reward } from '@/lib/types';
import type { 
  ApiResponse, 
  RewardFilters,
  RedeemRewardRequest,
  RedeemRewardResponse,
} from '@/lib/api/types';
import { 
  createSuccessResponse, 
  createErrorResponse,
  ErrorCodes,
  generateRewardCode,
} from '@/lib/api/client';
import { createClient } from '@/lib/supabase/client';

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

// Transform database reward to API reward type
function transformReward(dbReward: {
  id: string;
  reward_code: string;
  session_id: string;
  user_id: string;
  campaign_id: string;
  reward_type: string;
  reward_value: number | null;
  description: string | null;
  status: string;
  created_at: string;
  qualified_at: string | null;
  claimed_at: string | null;
  expires_at: string | null;
  actual_minutes: number | null;
  required_minutes: number | null;
  metadata: Record<string, unknown> | null;
  users?: { email: string; name: string | null } | null;
  campaigns?: { name: string } | null;
}): Reward {
  return {
    id: dbReward.id,
    code: dbReward.reward_code || generateRewardCode('POWERDON'),
    sessionId: dbReward.session_id,
    userId: dbReward.user_id,
    userEmail: dbReward.users?.email || '',
    campaignId: dbReward.campaign_id,
    campaignName: dbReward.campaigns?.name || 'Campaign',
    type: dbReward.reward_type as Reward['type'] || 'voucher',
    value: Number(dbReward.reward_value) || 10.00,
    description: dbReward.description || 'Reward for qualified rental',
    status: dbReward.status as Reward['status'] || 'issued',
    issuedAt: new Date(dbReward.created_at),
    expiresAt: dbReward.expires_at ? new Date(dbReward.expires_at) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    redeemedAt: dbReward.claimed_at ? new Date(dbReward.claimed_at) : undefined,
    redemptionLocation: dbReward.metadata?.redemption_location as string | undefined,
    qualifyingMinutes: dbReward.actual_minutes || undefined,
    thresholdMinutes: dbReward.required_minutes || 60,
  };
}

// Production implementation using Supabase
class SupabaseRewardService implements IRewardService {
  async getRewards(filters?: RewardFilters): Promise<ApiResponse<Reward[]>> {
    try {
      const supabase = createClient();
      
      let query = supabase
        .from('rewards')
        .select(`
          *,
          users:user_id(email, name),
          campaigns:campaign_id(name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters?.campaignId) {
        query = query.eq('campaign_id', filters.campaignId);
      }

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters?.search) {
        query = query.ilike('reward_code', `%${filters.search}%`);
      }

      if (filters?.dateRange?.from) {
        query = query.gte('created_at', filters.dateRange.from.toISOString());
      }

      if (filters?.dateRange?.to) {
        query = query.lte('created_at', filters.dateRange.to.toISOString());
      }

      // Apply pagination
      const page = filters?.page || 1;
      const limit = filters?.limit || 50;
      const start = (page - 1) * limit;
      query = query.range(start, start + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('[RewardService] Error fetching rewards:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch rewards');
      }

      const rewards = (data || []).map(transformReward);

      return createSuccessResponse(rewards, {
        page,
        limit,
        total: count || rewards.length,
      });
    } catch (err) {
      console.error('[RewardService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getRewardById(id: string): Promise<ApiResponse<Reward>> {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('rewards')
        .select(`
          *,
          users:user_id(email, name),
          campaigns:campaign_id(name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[RewardService] Error fetching reward:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch reward');
      }

      if (!data) {
        return createErrorResponse(ErrorCodes.REWARD_NOT_FOUND, `Reward ${id} not found`);
      }

      return createSuccessResponse(transformReward(data));
    } catch (err) {
      console.error('[RewardService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getRewardByCode(code: string): Promise<ApiResponse<Reward>> {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('rewards')
        .select(`
          *,
          users:user_id(email, name),
          campaigns:campaign_id(name)
        `)
        .eq('reward_code', code.toUpperCase())
        .maybeSingle();

      if (error) {
        console.error('[RewardService] Error fetching reward by code:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch reward');
      }

      if (!data) {
        return createErrorResponse(ErrorCodes.REWARD_NOT_FOUND, `Reward with code ${code} not found`);
      }

      return createSuccessResponse(transformReward(data));
    } catch (err) {
      console.error('[RewardService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getRewardsByUser(userEmail: string): Promise<ApiResponse<Reward[]>> {
    try {
      const supabase = createClient();
      
      // First get user by email
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', userEmail.toLowerCase())
        .maybeSingle();

      if (!user) {
        return createSuccessResponse([]);
      }

      const { data, error } = await supabase
        .from('rewards')
        .select(`
          *,
          users:user_id(email, name),
          campaigns:campaign_id(name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[RewardService] Error fetching user rewards:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch user rewards');
      }

      const rewards = (data || []).map(transformReward);

      return createSuccessResponse(rewards);
    } catch (err) {
      console.error('[RewardService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getRewardsBySession(sessionId: string): Promise<ApiResponse<Reward[]>> {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('rewards')
        .select(`
          *,
          users:user_id(email, name),
          campaigns:campaign_id(name)
        `)
        .eq('session_id', sessionId);

      if (error) {
        console.error('[RewardService] Error fetching session rewards:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch session rewards');
      }

      const rewards = (data || []).map(transformReward);

      return createSuccessResponse(rewards);
    } catch (err) {
      console.error('[RewardService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async issueReward(sessionId: string, campaignId: string): Promise<ApiResponse<Reward>> {
    try {
      const supabase = createClient();
      
      // Check if reward already exists for this session
      const { data: existingReward } = await supabase
        .from('rewards')
        .select(`
          *,
          users:user_id(email, name),
          campaigns:campaign_id(name)
        `)
        .eq('session_id', sessionId)
        .maybeSingle();

      if (existingReward) {
        return createSuccessResponse(transformReward(existingReward));
      }

      // Get session info
      const { data: session } = await supabase
        .from('rental_sessions')
        .select('user_id, duration_minutes')
        .eq('id', sessionId)
        .single();

      if (!session) {
        return createErrorResponse(ErrorCodes.SESSION_NOT_FOUND, 'Session not found');
      }

      // Get campaign info for reward value
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('reward_value, reward_description, reward_threshold_minutes')
        .eq('id', campaignId)
        .single();

      const rewardCode = generateRewardCode('POWERDON');
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const { data: newReward, error } = await supabase
        .from('rewards')
        .insert({
          reward_code: rewardCode,
          session_id: sessionId,
          user_id: session.user_id,
          campaign_id: campaignId,
          reward_type: 'voucher',
          reward_value: campaign?.reward_value || 10.00,
          description: campaign?.reward_description || 'Reward for qualified rental',
          status: 'issued',
          actual_minutes: session.duration_minutes,
          required_minutes: campaign?.reward_threshold_minutes || 60,
          expires_at: expiresAt.toISOString(),
        })
        .select(`
          *,
          users:user_id(email, name),
          campaigns:campaign_id(name)
        `)
        .single();

      if (error) {
        console.error('[RewardService] Error issuing reward:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to issue reward');
      }

      return createSuccessResponse(transformReward(newReward));
    } catch (err) {
      console.error('[RewardService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async redeemReward(request: RedeemRewardRequest): Promise<ApiResponse<RedeemRewardResponse>> {
    try {
      const supabase = createClient();
      
      // Get reward
      const { data: reward, error: getError } = await supabase
        .from('rewards')
        .select('*')
        .eq('id', request.rewardId)
        .single();

      if (getError || !reward) {
        return createErrorResponse(ErrorCodes.REWARD_NOT_FOUND, 'Reward not found');
      }

      // Validate reward code
      if (reward.reward_code !== request.rewardCode.toUpperCase()) {
        return createErrorResponse(ErrorCodes.VALIDATION_ERROR, 'Invalid reward code');
      }

      // Check if already redeemed
      if (reward.status === 'redeemed') {
        return createErrorResponse(ErrorCodes.REWARD_ALREADY_REDEEMED, 'This reward has already been redeemed');
      }

      // Check if expired
      if (reward.expires_at && new Date(reward.expires_at) < new Date()) {
        await supabase
          .from('rewards')
          .update({ status: 'expired' })
          .eq('id', request.rewardId);
        return createErrorResponse(ErrorCodes.REWARD_EXPIRED, 'This reward has expired');
      }

      // Redeem the reward
      const redeemedAt = new Date();
      const { error: updateError } = await supabase
        .from('rewards')
        .update({
          status: 'redeemed',
          claimed_at: redeemedAt.toISOString(),
          metadata: {
            ...(reward.metadata || {}),
            redemption_location: request.redemptionLocation,
          },
        })
        .eq('id', request.rewardId);

      if (updateError) {
        console.error('[RewardService] Error redeeming reward:', updateError);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to redeem reward');
      }

      return createSuccessResponse({
        success: true,
        rewardId: reward.id,
        value: Number(reward.reward_value),
        type: reward.reward_type,
        redeemedAt,
      });
    } catch (err) {
      console.error('[RewardService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getRewardStats(): Promise<ApiResponse<{
    totalIssued: number;
    totalRedeemed: number;
    totalExpired: number;
    pendingRedemption: number;
  }>> {
    try {
      const supabase = createClient();
      
      const [issuedResult, redeemedResult, expiredResult, pendingResult] = await Promise.all([
        supabase.from('rewards').select('id', { count: 'exact', head: true }),
        supabase.from('rewards').select('id', { count: 'exact', head: true }).eq('status', 'redeemed'),
        supabase.from('rewards').select('id', { count: 'exact', head: true }).eq('status', 'expired'),
        supabase.from('rewards').select('id', { count: 'exact', head: true }).in('status', ['qualified', 'issued']),
      ]);

      return createSuccessResponse({
        totalIssued: issuedResult.count || 0,
        totalRedeemed: redeemedResult.count || 0,
        totalExpired: expiredResult.count || 0,
        pendingRedemption: pendingResult.count || 0,
      });
    } catch (err) {
      console.error('[RewardService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }
}

// Export singleton instance - now using real Supabase implementation
export const rewardService: IRewardService = new SupabaseRewardService();
