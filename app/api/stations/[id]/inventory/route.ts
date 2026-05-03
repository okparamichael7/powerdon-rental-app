// Inventory endpoint for station
// GET /api/stations/[id]/inventory - Get current inventory

import { NextRequest, NextResponse } from 'next/server';
import { stationManager } from '@/lib/wscharge';
import * as protocol from '@/lib/wscharge/protocol';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stationId } = await params;
  
  try {
    const station = stationManager.getStation(stationId);
    
    if (!station) {
      return NextResponse.json(
        { success: false, error: 'Station not found or not connected' },
        { status: 404 }
      );
    }

    const inventory = station.inventory.map(slot => ({
      slotNumber: slot.slotNumber,
      terminalId: slot.terminalId,
      formattedTerminalId: protocol.formatTerminalId(slot.terminalId),
      batteryLevel: protocol.batteryLevelToPercent(slot.batteryLevel),
      batteryLevelRaw: slot.batteryLevel,
    }));

    // Sort by slot number
    inventory.sort((a, b) => a.slotNumber - b.slotNumber);

    return NextResponse.json({
      success: true,
      data: {
        stationId,
        isOnline: station.isOnline,
        totalSlots: 8, // Default - should come from station config
        availableSlots: inventory.length,
        lastUpdate: station.lastInventoryUpdate?.toISOString() || null,
        slots: inventory,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching inventory:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
}

// POST /api/stations/[id]/inventory - Request inventory refresh
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stationId } = await params;
  
  try {
    const station = stationManager.getStation(stationId);
    
    if (!station || !station.isOnline) {
      return NextResponse.json(
        { success: false, error: 'Station not connected' },
        { status: 503 }
      );
    }

    // Send inventory query command
    const result = await stationManager.sendCommand<protocol.InventoryResponse>(
      stationId,
      protocol.CommandCode.QUERY_INVENTORY
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to query inventory' },
        { status: 500 }
      );
    }

    const inventoryResponse = result.data;
    
    if (!inventoryResponse) {
      return NextResponse.json(
        { success: false, error: 'No inventory data received' },
        { status: 500 }
      );
    }

    const inventory = inventoryResponse.slots.map(slot => ({
      slotNumber: slot.slotNumber,
      terminalId: slot.terminalId,
      formattedTerminalId: protocol.formatTerminalId(slot.terminalId),
      batteryLevel: protocol.batteryLevelToPercent(slot.batteryLevel),
    }));

    // Sort by slot number
    inventory.sort((a, b) => a.slotNumber - b.slotNumber);

    return NextResponse.json({
      success: true,
      data: {
        stationId,
        isOnline: true,
        totalSlots: 8,
        availableSlots: inventoryResponse.remainingCount,
        lastUpdate: new Date().toISOString(),
        slots: inventory,
      },
    });
  } catch (error) {
    console.error('[API] Error refreshing inventory:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to refresh inventory' },
      { status: 500 }
    );
  }
}
