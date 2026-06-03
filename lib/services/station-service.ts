// Station service - handles all station-related operations
// Production implementation using Supabase

import type { Station } from '@/lib/types';
import type { 
  ApiResponse, 
  StationFilters, 
  StationAvailabilityRequest, 
  StationAvailabilityResponse 
} from '@/lib/api/types';
import { 
  createSuccessResponse, 
  createErrorResponse,
  ErrorCodes,
} from '@/lib/api/client';
import { createClient } from '@/lib/supabase/client';

// Station service interface
export interface IStationService {
  getStations(filters?: StationFilters): Promise<ApiResponse<Station[]>>;
  getStationById(id: string): Promise<ApiResponse<Station>>;
  checkAvailability(request: StationAvailabilityRequest): Promise<ApiResponse<StationAvailabilityResponse>>;
  getStationsByCampaign(campaignId: string): Promise<ApiResponse<Station[]>>;
  updateStationStatus(id: string, status: Station['status']): Promise<ApiResponse<Station>>;
}

// Transform database station to API station type
function transformStation(dbStation: {
  id: string;
  device_id: string;
  name: string | null;
  location_description: string | null;
  status: string;
  total_slots: number;
  campaign_id: string | null;
  last_heartbeat: string | null;
  latitude: number | null;
  longitude: number | null;
  signal_strength: number | null;
  hardware_version: string | null;
  software_version: string | null;
  created_at: string;
  slots?: Array<{ status: string; battery_level: number | null }>;
  campaigns?: { name: string; hourly_rate: number; deposit_amount: number; reward_threshold_minutes: number; reward_description: string | null } | null;
}): Station {
  const slots = dbStation.slots || [];
  const availableSlots = slots.filter(s => s.status === 'occupied' && (s.battery_level || 0) >= 20).length;
  
  return {
    id: dbStation.device_id || dbStation.id,
    name: dbStation.name || `Station ${dbStation.device_id?.slice(-6) || 'Unknown'}`,
    location: dbStation.location_description || 'Location not set',
    status: (dbStation.status as Station['status']) || 'offline',
    availableSlots,
    totalSlots: dbStation.total_slots || 6,
    campaignId: dbStation.campaign_id || undefined,
    campaignName: dbStation.campaigns?.name,
    hourlyRate: dbStation.campaigns?.hourly_rate || 4.00,
    dailyCap: 27.00, // EUR ladder pricing daily cap
    depositAmount: dbStation.campaigns?.deposit_amount || 28.00,
    rewardThreshold: dbStation.campaigns?.reward_threshold_minutes || 60,
    rewardDescription: dbStation.campaigns?.reward_description || undefined,
    lastPing: dbStation.last_heartbeat ? new Date(dbStation.last_heartbeat) : undefined,
    latitude: dbStation.latitude ? Number(dbStation.latitude) : undefined,
    longitude: dbStation.longitude ? Number(dbStation.longitude) : undefined,
    signalStrength: dbStation.signal_strength || undefined,
    hardwareVersion: dbStation.hardware_version || undefined,
    softwareVersion: dbStation.software_version || undefined,
  };
}

// Production implementation using Supabase
class SupabaseStationService implements IStationService {
  async getStations(filters?: StationFilters): Promise<ApiResponse<Station[]>> {
    try {
      const supabase = createClient();
      
      let query = supabase
        .from('stations')
        .select(`
          *,
          slots:slots(*),
          campaigns:campaigns(name, hourly_rate, deposit_amount, reward_threshold_minutes, reward_description)
        `)
        .order('name');

      // Apply filters
      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters?.campaignId) {
        query = query.eq('campaign_id', filters.campaignId);
      }

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,location_description.ilike.%${filters.search}%,device_id.ilike.%${filters.search}%`);
      }

      // Apply pagination
      const page = filters?.page || 1;
      const limit = filters?.limit || 50;
      const start = (page - 1) * limit;
      query = query.range(start, start + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('[StationService] Error fetching stations:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch stations');
      }

      const stations = (data || []).map(transformStation);

      return createSuccessResponse(stations, {
        page,
        limit,
        total: count || stations.length,
      });
    } catch (err) {
      console.error('[StationService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getStationById(id: string): Promise<ApiResponse<Station>> {
    try {
      const supabase = createClient();
      
      // Try to find by device_id first, then by UUID
      let query = supabase
        .from('stations')
        .select(`
          *,
          slots:slots(*),
          campaigns:campaigns(name, hourly_rate, deposit_amount, reward_threshold_minutes, reward_description)
        `)
        .eq('device_id', id)
        .maybeSingle();

      let { data, error } = await query;

      // If not found by device_id, try UUID
      if (!data && !error) {
        const uuidQuery = supabase
          .from('stations')
          .select(`
            *,
            slots:slots(*),
            campaigns:campaigns(name, hourly_rate, deposit_amount, reward_threshold_minutes, reward_description)
          `)
          .eq('id', id)
          .maybeSingle();
        
        const result = await uuidQuery;
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('[StationService] Error fetching station:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch station');
      }

      if (!data) {
        return createErrorResponse(ErrorCodes.NOT_FOUND, `Station ${id} not found`);
      }

      return createSuccessResponse(transformStation(data));
    } catch (err) {
      console.error('[StationService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async checkAvailability(request: StationAvailabilityRequest): Promise<ApiResponse<StationAvailabilityResponse>> {
    try {
      const stationResult = await this.getStationById(request.stationId);
      
      if (!stationResult.success || !stationResult.data) {
        return createErrorResponse(ErrorCodes.NOT_FOUND, `Station ${request.stationId} not found`);
      }

      const station = stationResult.data;

      if (station.status === 'offline') {
        return createSuccessResponse({
          stationId: station.id,
          isAvailable: false,
          availableSlots: 0,
          estimatedWaitMinutes: undefined,
        });
      }

      if (station.status === 'maintenance') {
        return createSuccessResponse({
          stationId: station.id,
          isAvailable: false,
          availableSlots: 0,
          estimatedWaitMinutes: 30,
        });
      }

      const isAvailable = station.availableSlots > 0;
      
      return createSuccessResponse({
        stationId: station.id,
        isAvailable,
        availableSlots: station.availableSlots,
        estimatedWaitMinutes: isAvailable ? undefined : 15,
        nextAvailableSlot: isAvailable ? 1 : undefined,
      });
    } catch (err) {
      console.error('[StationService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getStationsByCampaign(campaignId: string): Promise<ApiResponse<Station[]>> {
    return this.getStations({ campaignId });
  }

  async updateStationStatus(id: string, status: Station['status']): Promise<ApiResponse<Station>> {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('stations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('device_id', id)
        .select(`
          *,
          slots:slots(*),
          campaigns:campaigns(name, hourly_rate, deposit_amount, reward_threshold_minutes, reward_description)
        `)
        .single();

      if (error) {
        console.error('[StationService] Error updating station status:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to update station status');
      }

      return createSuccessResponse(transformStation(data));
    } catch (err) {
      console.error('[StationService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }
}

// Export singleton instance - now using real Supabase implementation
export const stationService: IStationService = new SupabaseStationService();
