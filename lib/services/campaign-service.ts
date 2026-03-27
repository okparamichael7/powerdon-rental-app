// Campaign service - handles all campaign operations
// Mock implementation with interface ready for real backend

import type { Campaign } from '@/lib/types';
import type { 
  ApiResponse, 
  CampaignFilters,
  CreateCampaignRequest,
  UpdateCampaignRequest,
} from '@/lib/api/types';
import { 
  simulateNetworkDelay, 
  createSuccessResponse, 
  createErrorResponse,
  ErrorCodes,
  generateId,
} from '@/lib/api/client';
import { mockCampaigns } from '@/lib/mock-data';

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

// In-memory campaign store
let campaigns: Campaign[] = [...mockCampaigns];

// Mock implementation
class MockCampaignService implements ICampaignService {
  async getCampaigns(filters?: CampaignFilters): Promise<ApiResponse<Campaign[]>> {
    await simulateNetworkDelay();

    let result = [...campaigns];

    // Apply filters
    if (filters?.isActive !== undefined) {
      result = result.filter(c => c.isActive === filters.isActive);
    }

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(search) || 
        c.eventName.toLowerCase().includes(search)
      );
    }

    if (filters?.dateRange) {
      if (filters.dateRange.from) {
        result = result.filter(c => c.startDate >= filters.dateRange!.from!);
      }
      if (filters.dateRange.to) {
        result = result.filter(c => c.endDate <= filters.dateRange!.to!);
      }
    }

    // Sort by start date (newest first)
    result.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

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

  async getCampaignById(id: string): Promise<ApiResponse<Campaign>> {
    await simulateNetworkDelay();

    const campaign = campaigns.find(c => c.id === id);
    
    if (!campaign) {
      return createErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Campaign ${id} not found`
      );
    }

    return createSuccessResponse(campaign);
  }

  async getActiveCampaigns(): Promise<ApiResponse<Campaign[]>> {
    await simulateNetworkDelay();

    const now = new Date();
    const activeCampaigns = campaigns.filter(c => 
      c.isActive && c.startDate <= now && c.endDate >= now
    );

    return createSuccessResponse(activeCampaigns);
  }

  async createCampaign(request: CreateCampaignRequest): Promise<ApiResponse<Campaign>> {
    await simulateNetworkDelay();

    const newCampaign: Campaign = {
      id: generateId('CMP'),
      name: request.name,
      eventName: request.eventName,
      startDate: request.startDate,
      endDate: request.endDate,
      hourlyRate: request.hourlyRate,
      dailyCap: request.dailyCap,
      depositAmount: request.depositAmount,
      rewardThresholdMinutes: request.rewardThresholdMinutes,
      rewardType: request.rewardType,
      rewardValue: request.rewardValue,
      rewardDescription: request.rewardDescription,
      isActive: true,
      totalSessions: 0,
      totalRewardsIssued: 0,
    };

    campaigns.unshift(newCampaign);

    return createSuccessResponse(newCampaign);
  }

  async updateCampaign(id: string, request: UpdateCampaignRequest): Promise<ApiResponse<Campaign>> {
    await simulateNetworkDelay();

    const campaignIndex = campaigns.findIndex(c => c.id === id);
    
    if (campaignIndex === -1) {
      return createErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Campaign ${id} not found`
      );
    }

    campaigns[campaignIndex] = {
      ...campaigns[campaignIndex],
      ...request,
    };

    return createSuccessResponse(campaigns[campaignIndex]);
  }

  async deleteCampaign(id: string): Promise<ApiResponse<void>> {
    await simulateNetworkDelay();

    const campaignIndex = campaigns.findIndex(c => c.id === id);
    
    if (campaignIndex === -1) {
      return createErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Campaign ${id} not found`
      );
    }

    campaigns.splice(campaignIndex, 1);

    return createSuccessResponse(undefined);
  }

  async toggleCampaignActive(id: string, isActive: boolean): Promise<ApiResponse<Campaign>> {
    await simulateNetworkDelay();

    const campaignIndex = campaigns.findIndex(c => c.id === id);
    
    if (campaignIndex === -1) {
      return createErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Campaign ${id} not found`
      );
    }

    campaigns[campaignIndex] = {
      ...campaigns[campaignIndex],
      isActive,
    };

    return createSuccessResponse(campaigns[campaignIndex]);
  }
}

// Export singleton instance
export const campaignService: ICampaignService = new MockCampaignService();
