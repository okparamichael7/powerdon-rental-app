// Campaign service - handles all campaign operations
// Production implementation using Supabase

import type { Campaign } from '@/lib/types';
import type { 
  ApiResponse, 
  CampaignFilters,
  CreateCampaignRequest,
  UpdateCampaignRequest,
} from '@/lib/api/types';
import { 
  createSuccessResponse, 
  createErrorResponse,
  ErrorCodes,
} from '@/lib/api/client';
import { createClient } from '@/lib/supabase/client';

// Campaign service interface
export interface ICampaignService {
  getCampaigns(filters?: CampaignFilters): Promise<ApiResponse<Campaign[]>>;
  getCampaignById(id: string): Promise<ApiResponse<Campaign>>;
  getActiveCampaigns(): Promise<ApiResponse<Campaign[]>>;
  createCampaign(request: CreateCampaignRequest): Promise<ApiResponse<Campaign>>;
  updateCampaign(id: string, request: UpdateCampaignRequest): Promise<ApiResponse<Campaign>>;
  deleteCampaign(id: string): Promise<ApiResponse<void>>;
  toggleCampaignActive(id: string, isActive: boolean): Promise<ApiResponse<Campaign>>;
}

// Transform database campaign to API campaign type
function transformCampaign(dbCampaign: {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  hourly_rate: number;
  deposit_amount: number;
  reward_threshold_minutes: number;
  reward_value: number | null;
  reward_description: string | null;
  is_active: boolean;
  created_at: string;
  _count?: { sessions: number; rewards: number };
}): Campaign {
  return {
    id: dbCampaign.id,
    name: dbCampaign.name,
    eventName: dbCampaign.description || dbCampaign.name,
    startDate: new Date(dbCampaign.start_date),
    endDate: new Date(dbCampaign.end_date),
    hourlyRate: Number(dbCampaign.hourly_rate) || 4.00,
    dailyCap: 27.00, // EUR ladder pricing
    depositAmount: Number(dbCampaign.deposit_amount) || 28.00,
    rewardThresholdMinutes: dbCampaign.reward_threshold_minutes || 60,
    rewardType: 'voucher',
    rewardValue: Number(dbCampaign.reward_value) || 10.00,
    rewardDescription: dbCampaign.reward_description || 'Reward for qualified rental',
    isActive: dbCampaign.is_active,
    totalSessions: dbCampaign._count?.sessions || 0,
    totalRewardsIssued: dbCampaign._count?.rewards || 0,
  };
}

// Production implementation using Supabase
class SupabaseCampaignService implements ICampaignService {
  async getCampaigns(filters?: CampaignFilters): Promise<ApiResponse<Campaign[]>> {
    try {
      const supabase = createClient();
      
      let query = supabase
        .from('campaigns')
        .select('*', { count: 'exact' })
        .order('start_date', { ascending: false });

      // Apply filters
      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      if (filters?.dateRange?.from) {
        query = query.gte('start_date', filters.dateRange.from.toISOString());
      }

      if (filters?.dateRange?.to) {
        query = query.lte('end_date', filters.dateRange.to.toISOString());
      }

      // Apply pagination
      const page = filters?.page || 1;
      const limit = filters?.limit || 50;
      const start = (page - 1) * limit;
      query = query.range(start, start + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('[CampaignService] Error fetching campaigns:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch campaigns');
      }

      // Get session and reward counts for each campaign
      const campaignIds = (data || []).map(c => c.id);
      
      const [sessionsResult, rewardsResult] = await Promise.all([
        supabase
          .from('rental_sessions')
          .select('campaign_id')
          .in('campaign_id', campaignIds),
        supabase
          .from('rewards')
          .select('campaign_id')
          .in('campaign_id', campaignIds),
      ]);

      const sessionCounts = new Map<string, number>();
      const rewardCounts = new Map<string, number>();
      
      (sessionsResult.data || []).forEach(s => {
        if (s.campaign_id) {
          sessionCounts.set(s.campaign_id, (sessionCounts.get(s.campaign_id) || 0) + 1);
        }
      });
      
      (rewardsResult.data || []).forEach(r => {
        if (r.campaign_id) {
          rewardCounts.set(r.campaign_id, (rewardCounts.get(r.campaign_id) || 0) + 1);
        }
      });

      const campaigns = (data || []).map(c => transformCampaign({
        ...c,
        _count: {
          sessions: sessionCounts.get(c.id) || 0,
          rewards: rewardCounts.get(c.id) || 0,
        },
      }));

      return createSuccessResponse(campaigns, {
        page,
        limit,
        total: count || campaigns.length,
      });
    } catch (err) {
      console.error('[CampaignService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getCampaignById(id: string): Promise<ApiResponse<Campaign>> {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[CampaignService] Error fetching campaign:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch campaign');
      }

      if (!data) {
        return createErrorResponse(ErrorCodes.NOT_FOUND, `Campaign ${id} not found`);
      }

      // Get counts
      const [sessionsResult, rewardsResult] = await Promise.all([
        supabase
          .from('rental_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', id),
        supabase
          .from('rewards')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', id),
      ]);

      return createSuccessResponse(transformCampaign({
        ...data,
        _count: {
          sessions: sessionsResult.count || 0,
          rewards: rewardsResult.count || 0,
        },
      }));
    } catch (err) {
      console.error('[CampaignService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getActiveCampaigns(): Promise<ApiResponse<Campaign[]>> {
    try {
      const supabase = createClient();
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)
        .order('start_date', { ascending: false });

      if (error) {
        console.error('[CampaignService] Error fetching active campaigns:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch active campaigns');
      }

      const campaigns = (data || []).map(c => transformCampaign(c));

      return createSuccessResponse(campaigns);
    } catch (err) {
      console.error('[CampaignService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async createCampaign(request: CreateCampaignRequest): Promise<ApiResponse<Campaign>> {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          name: request.name,
          description: request.eventName,
          start_date: request.startDate.toISOString(),
          end_date: request.endDate.toISOString(),
          hourly_rate: request.hourlyRate,
          deposit_amount: request.depositAmount,
          reward_threshold_minutes: request.rewardThresholdMinutes,
          reward_value: request.rewardValue,
          reward_description: request.rewardDescription,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('[CampaignService] Error creating campaign:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to create campaign');
      }

      return createSuccessResponse(transformCampaign(data));
    } catch (err) {
      console.error('[CampaignService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async updateCampaign(id: string, request: UpdateCampaignRequest): Promise<ApiResponse<Campaign>> {
    try {
      const supabase = createClient();
      
      const updates: Record<string, unknown> = {};
      if (request.name !== undefined) updates.name = request.name;
      if (request.eventName !== undefined) updates.description = request.eventName;
      if (request.startDate !== undefined) updates.start_date = request.startDate.toISOString();
      if (request.endDate !== undefined) updates.end_date = request.endDate.toISOString();
      if (request.hourlyRate !== undefined) updates.hourly_rate = request.hourlyRate;
      if (request.depositAmount !== undefined) updates.deposit_amount = request.depositAmount;
      if (request.rewardThresholdMinutes !== undefined) updates.reward_threshold_minutes = request.rewardThresholdMinutes;
      if (request.rewardValue !== undefined) updates.reward_value = request.rewardValue;
      if (request.rewardDescription !== undefined) updates.reward_description = request.rewardDescription;
      if (request.isActive !== undefined) updates.is_active = request.isActive;
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[CampaignService] Error updating campaign:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to update campaign');
      }

      return createSuccessResponse(transformCampaign(data));
    } catch (err) {
      console.error('[CampaignService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async deleteCampaign(id: string): Promise<ApiResponse<void>> {
    try {
      const supabase = createClient();
      
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[CampaignService] Error deleting campaign:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to delete campaign');
      }

      return createSuccessResponse(undefined);
    } catch (err) {
      console.error('[CampaignService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async toggleCampaignActive(id: string, isActive: boolean): Promise<ApiResponse<Campaign>> {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('campaigns')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[CampaignService] Error toggling campaign:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to toggle campaign');
      }

      return createSuccessResponse(transformCampaign(data));
    } catch (err) {
      console.error('[CampaignService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }
}

// Export singleton instance - now using real Supabase implementation
export const campaignService: ICampaignService = new SupabaseCampaignService();
