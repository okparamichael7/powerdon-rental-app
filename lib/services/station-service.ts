// Station service - handles all station-related operations
// Mock implementation with interface ready for real backend

import type { Station } from '@/lib/types';
import type { 
  ApiResponse, 
  StationFilters, 
  StationAvailabilityRequest, 
  StationAvailabilityResponse 
} from '@/lib/api/types';
import { 
  simulateNetworkDelay, 
  createSuccessResponse, 
  createErrorResponse,
  ErrorCodes,
  generateId,
} from '@/lib/api/client';
import { mockStations } from '@/lib/mock-data';

// Station service interface
export interface IStationService {
  getStations(filters?: StationFilters): Promise<ApiResponse<Station[]>>;
  getStationById(id: string): Promise<ApiResponse<Station>>;
  checkAvailability(request: StationAvailabilityRequest): Promise<ApiResponse<StationAvailabilityResponse>>;
  getStationsByCampaign(campaignId: string): Promise<ApiResponse<Station[]>>;
  updateStationStatus(id: string, status: Station['status']): Promise<ApiResponse<Station>>;
}

// Mock implementation
class MockStationService implements IStationService {
  private stations: Station[] = [...mockStations];

  async getStations(filters?: StationFilters): Promise<ApiResponse<Station[]>> {
    await simulateNetworkDelay();

    let result = [...this.stations];

    // Apply filters
    if (filters?.status && filters.status.length > 0) {
      result = result.filter(s => filters.status!.includes(s.status));
    }

    if (filters?.campaignId) {
      result = result.filter(s => s.campaignId === filters.campaignId);
    }

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(search) || 
        s.location.toLowerCase().includes(search) ||
        s.id.toLowerCase().includes(search)
      );
    }

    // Apply sorting
    if (filters?.sortBy) {
      const sortOrder = filters.sortOrder === 'desc' ? -1 : 1;
      result.sort((a, b) => {
        const aVal = a[filters.sortBy as keyof Station];
        const bVal = b[filters.sortBy as keyof Station];
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return aVal.localeCompare(bVal) * sortOrder;
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * sortOrder;
        }
        return 0;
      });
    }

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

  async getStationById(id: string): Promise<ApiResponse<Station>> {
    await simulateNetworkDelay();

    const station = this.stations.find(s => s.id === id);
    
    if (!station) {
      return createErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Station ${id} not found`
      );
    }

    return createSuccessResponse(station);
  }

  async checkAvailability(request: StationAvailabilityRequest): Promise<ApiResponse<StationAvailabilityResponse>> {
    await simulateNetworkDelay();

    const station = this.stations.find(s => s.id === request.stationId);
    
    if (!station) {
      return createErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Station ${request.stationId} not found`
      );
    }

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
        estimatedWaitMinutes: 30, // Estimated maintenance time
      });
    }

    const isAvailable = station.availableSlots > 0;
    
    return createSuccessResponse({
      stationId: station.id,
      isAvailable,
      availableSlots: station.availableSlots,
      estimatedWaitMinutes: isAvailable ? undefined : 15,
      nextAvailableSlot: isAvailable ? Math.floor(Math.random() * station.totalSlots) + 1 : undefined,
    });
  }

  async getStationsByCampaign(campaignId: string): Promise<ApiResponse<Station[]>> {
    await simulateNetworkDelay();

    const campaignStations = this.stations.filter(s => s.campaignId === campaignId);
    
    return createSuccessResponse(campaignStations);
  }

  async updateStationStatus(id: string, status: Station['status']): Promise<ApiResponse<Station>> {
    await simulateNetworkDelay();

    const stationIndex = this.stations.findIndex(s => s.id === id);
    
    if (stationIndex === -1) {
      return createErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Station ${id} not found`
      );
    }

    this.stations[stationIndex] = {
      ...this.stations[stationIndex],
      status,
      lastPing: new Date(),
    };

    return createSuccessResponse(this.stations[stationIndex]);
  }
}

// Export singleton instance
export const stationService: IStationService = new MockStationService();
