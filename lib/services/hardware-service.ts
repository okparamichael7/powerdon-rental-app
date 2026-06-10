// Hardware service - bridges WsCharge protocol with business logic
// Handles communication between the app services and physical stations

import { stationManager, ConnectionEvent } from '@/lib/wscharge';
import * as protocol from '@/lib/wscharge/protocol';
import type { ApiResponse } from '@/lib/api/types';
import { createSuccessResponse, createErrorResponse, ErrorCodes } from '@/lib/api/client';

// Hardware command result types
export interface UnlockResult {
  success: boolean;
  slotNumber: number;
  terminalId: string;
  batteryLevel: number;
}

export interface StationStatus {
  stationId: string;
  isOnline: boolean;
  availableSlots: number;
  totalSlots: number;
  lastHeartbeat: Date | null;
  inventory: {
    slotNumber: number;
    terminalId: string;
    batteryLevel: number;
  }[];
}

// Event handlers storage
const returnEventHandlers: Map<string, (terminalId: string, slotNumber: number) => void> = new Map();

// Hardware service interface
export interface IHardwareService {
  // Station status
  getStationStatus(stationId: string): Promise<ApiResponse<StationStatus>>;
  isStationOnline(stationId: string): boolean;
  getAvailableSlots(stationId: string): number;
  
  // Unlock/borrow operations
  unlockSlot(stationId: string, slotNumber?: number): Promise<ApiResponse<UnlockResult>>;
  getBestSlot(stationId: string): { slotNumber: number; batteryLevel: number } | null;
  
  // Return handling
  onPowerBankReturn(stationId: string, callback: (terminalId: string, slotNumber: number) => void): () => void;
  
  // Admin operations
  forceEject(stationId: string, slotNumber: number): Promise<ApiResponse<UnlockResult>>;
  fullEject(stationId: string): Promise<ApiResponse<{ ejectedSlots: number }>>;
  refreshInventory(stationId: string): Promise<ApiResponse<StationStatus>>;
  rebootStation(stationId: string): Promise<ApiResponse<void>>;
}

class HardwareService implements IHardwareService {
  constructor() {
    // Listen for return events from stations
    stationManager.addEventListener(this.handleConnectionEvent.bind(this));
  }

  private handleConnectionEvent(event: ConnectionEvent): void {
    if (event.type === 'powerbank_returned') {
      const terminalId = event.data?.terminalId as string;
      const slotNumber = event.data?.slotNumber as number;
      
      // Notify all registered handlers for this station
      const handler = returnEventHandlers.get(event.stationId);
      if (handler && terminalId && typeof slotNumber === 'number') {
        handler(terminalId, slotNumber);
      }
    }
  }

  async getStationStatus(stationId: string): Promise<ApiResponse<StationStatus>> {
    const station = stationManager.getStation(stationId);
    
    if (!station) {
      return createErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Station not connected'
      );
    }

    return createSuccessResponse({
      stationId: station.stationId,
      isOnline: station.isOnline,
      availableSlots: station.inventory.length,
      totalSlots: 8, // Default
      lastHeartbeat: station.lastHeartbeat,
      inventory: station.inventory.map(slot => ({
        slotNumber: slot.slotNumber,
        terminalId: protocol.formatTerminalId(slot.terminalId),
        batteryLevel: protocol.batteryLevelToPercent(slot.batteryLevel),
      })),
    });
  }

  isStationOnline(stationId: string): boolean {
    const station = stationManager.getStation(stationId);
    return station?.isOnline ?? false;
  }

  getAvailableSlots(stationId: string): number {
    const station = stationManager.getStation(stationId);
    return station?.inventory.length ?? 0;
  }

  async unlockSlot(stationId: string, slotNumber?: number): Promise<ApiResponse<UnlockResult>> {
    const station = stationManager.getStation(stationId);
    
    if (!station || !station.isOnline) {
      return createErrorResponse(
        ErrorCodes.STATION_OFFLINE,
        'Station is not online'
      );
    }

    // Determine target slot
    let targetSlot: protocol.SlotInventory | undefined;
    
    if (typeof slotNumber === 'number') {
      targetSlot = station.inventory.find(s => s.slotNumber === slotNumber);
      if (!targetSlot) {
        return createErrorResponse(
          ErrorCodes.SLOT_UNAVAILABLE,
          `Slot ${slotNumber} is not available`
        );
      }
    } else {
      // Get best available slot
      const best = stationManager.getBestAvailableSlot(stationId);
      if (!best) {
        return createErrorResponse(
          ErrorCodes.NO_SLOTS_AVAILABLE,
          'No power banks available'
        );
      }
      targetSlot = best;
    }

    // Send borrow command
    const payload = Buffer.alloc(1);
    payload.writeUInt8(targetSlot.slotNumber, 0);
    
    const result = await stationManager.sendCommand<protocol.BorrowResponse>(
      stationId,
      protocol.CommandCode.BORROW_POWERBANK,
      payload
    );

    if (!result.success) {
      return createErrorResponse(
        ErrorCodes.UNLOCK_FAILED,
        result.error || 'Failed to unlock power bank'
      );
    }

    const borrowResponse = result.data;
    
    if (!borrowResponse || borrowResponse.result !== protocol.BorrowResult.SUCCESS) {
      return createErrorResponse(
        ErrorCodes.UNLOCK_FAILED,
        'Station failed to unlock slot'
      );
    }

    return createSuccessResponse({
      success: true,
      slotNumber: borrowResponse.slotNumber,
      terminalId: protocol.formatTerminalId(borrowResponse.terminalId),
      batteryLevel: protocol.batteryLevelToPercent(targetSlot.batteryLevel),
    });
  }

  getBestSlot(stationId: string): { slotNumber: number; batteryLevel: number } | null {
    const best = stationManager.getBestAvailableSlot(stationId);
    if (!best) return null;
    
    return {
      slotNumber: best.slotNumber,
      batteryLevel: protocol.batteryLevelToPercent(best.batteryLevel),
    };
  }

  onPowerBankReturn(stationId: string, callback: (terminalId: string, slotNumber: number) => void): () => void {
    returnEventHandlers.set(stationId, callback);
    
    // Return cleanup function
    return () => {
      returnEventHandlers.delete(stationId);
    };
  }

  async forceEject(stationId: string, slotNumber: number): Promise<ApiResponse<UnlockResult>> {
    const station = stationManager.getStation(stationId);
    
    if (!station || !station.isOnline) {
      return createErrorResponse(
        ErrorCodes.STATION_OFFLINE,
        'Station is not online'
      );
    }

    const payload = Buffer.alloc(1);
    payload.writeUInt8(slotNumber, 0);
    
    const result = await stationManager.sendCommand<protocol.ForceEjectResponse>(
      stationId,
      protocol.CommandCode.FORCE_EJECT,
      payload
    );

    if (!result.success) {
      return createErrorResponse(
        ErrorCodes.UNLOCK_FAILED,
        result.error || 'Failed to force eject'
      );
    }

    const ejectResponse = result.data;
    
    if (!ejectResponse || ejectResponse.result !== protocol.BorrowResult.SUCCESS) {
      return createErrorResponse(
        ErrorCodes.UNLOCK_FAILED,
        'Station failed to eject slot'
      );
    }

    return createSuccessResponse({
      success: true,
      slotNumber: ejectResponse.slotNumber,
      terminalId: protocol.formatTerminalId(ejectResponse.terminalId),
      batteryLevel: 0, // Unknown after force eject
    });
  }

  async fullEject(stationId: string): Promise<ApiResponse<{ ejectedSlots: number; variants?: string[] }>> {
    const result = await stationManager.sendFullEject(stationId);

    if (!result.success) {
      return createErrorResponse(
        ErrorCodes.COMMAND_FAILED,
        result.error || 'Failed to send full eject command'
      );
    }

    const station = stationManager.getStation(stationId);
    const slotCount = station?.inventory.length ?? 0;

    return createSuccessResponse({
      ejectedSlots: slotCount,
      variants: result.variants,
    });
  }

  async refreshInventory(stationId: string): Promise<ApiResponse<StationStatus>> {
    const station = stationManager.getStation(stationId);
    
    if (!station || !station.isOnline) {
      return createErrorResponse(
        ErrorCodes.STATION_OFFLINE,
        'Station is not online'
      );
    }

    const result = await stationManager.sendCommand<protocol.InventoryResponse>(
      stationId,
      protocol.CommandCode.QUERY_INVENTORY
    );

    if (!result.success) {
      return createErrorResponse(
        ErrorCodes.COMMAND_FAILED,
        result.error || 'Failed to query inventory'
      );
    }

    // Get updated status
    return this.getStationStatus(stationId);
  }

  async rebootStation(stationId: string): Promise<ApiResponse<void>> {
    const station = stationManager.getStation(stationId);
    
    if (!station || !station.isOnline) {
      return createErrorResponse(
        ErrorCodes.STATION_OFFLINE,
        'Station is not online'
      );
    }

    const result = await stationManager.sendCommand(
      stationId,
      protocol.CommandCode.REMOTE_REBOOT
    );

    if (!result.success) {
      return createErrorResponse(
        ErrorCodes.COMMAND_FAILED,
        result.error || 'Failed to reboot station'
      );
    }

    return createSuccessResponse(undefined);
  }
}

// Export singleton instance
export const hardwareService: IHardwareService = new HardwareService();
