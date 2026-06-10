// Inventory endpoint for station
// GET /api/stations/[id]/inventory - Get current inventory from database
// POST /api/stations/[id]/inventory - Request inventory refresh via TCP proxy

import { NextRequest, NextResponse } from 'next/server';
import { stationManager } from '@/lib/wscharge';
import * as protocol from '@/lib/wscharge/protocol';
import { stationRepository } from '@/lib/db';
import { resolveDbStationId } from '@/lib/db/station-resolve';
import { withPublicApi } from '@/lib/api/public-route';

async function loadDbStation(stationId: string) {
  const dbId = await resolveDbStationId(stationId);
  if (!dbId) return null;
  return stationRepository.getById(dbId);
}

function mapDbInventory(dbStation: NonNullable<Awaited<ReturnType<typeof loadDbStation>>>) {
  const occupied = dbStation.slots.filter((s) => s.status === 'occupied');
  const inventory = occupied.map((slot) => ({
    slotNumber: slot.slot_number,
    terminalId: slot.power_bank_id ?? '',
    formattedTerminalId: slot.power_bank_id ?? '',
    batteryLevel: slot.battery_level ?? 0,
    batteryLevelRaw: slot.battery_level,
  }));
  inventory.sort((a, b) => a.slotNumber - b.slotNumber);
  return {
    stationId: dbStation.id,
    isOnline: dbStation.status === 'online',
    totalSlots: dbStation.total_slots,
    availableSlots: occupied.length,
    lastUpdate: dbStation.last_inventory_sync ?? dbStation.last_heartbeat,
    slots: inventory,
  };
}

export const GET = withPublicApi(async (
  _request: NextRequest,
  context?: { params: Promise<{ id: string }> },
) => {
  const { id: stationId } = await context!.params;

  try {
    const dbStation = await loadDbStation(stationId);
    if (!dbStation) {
      return NextResponse.json(
        { success: false, error: 'Station not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: mapDbInventory(dbStation),
    });
  } catch (error) {
    console.error('[API] Error fetching inventory:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
});

export const POST = withPublicApi(async (
  _request: NextRequest,
  context?: { params: Promise<{ id: string }> },
) => {
  const { id: stationId } = await context!.params;

  try {
    const dbStation = await loadDbStation(stationId);
    if (!dbStation || dbStation.status !== 'online') {
      return NextResponse.json(
        { success: false, error: 'Station not connected' },
        { status: 503 }
      );
    }

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

    if (result.proxyOnly) {
      await new Promise((r) => setTimeout(r, 3000));
      const refreshed = await loadDbStation(stationId);
      if (!refreshed) {
        return NextResponse.json(
          { success: false, error: 'Station not found after inventory sync' },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        data: mapDbInventory(refreshed),
      });
    }

    const inventoryResponse = result.data;
    if (!inventoryResponse) {
      return NextResponse.json(
        { success: false, error: 'No inventory data received' },
        { status: 500 }
      );
    }

    const inventory = inventoryResponse.slots.map((slot) => ({
      slotNumber: slot.slotNumber,
      terminalId: slot.terminalId,
      formattedTerminalId: protocol.formatTerminalId(slot.terminalId),
      batteryLevel: protocol.batteryLevelToPercent(slot.batteryLevel),
    }));
    inventory.sort((a, b) => a.slotNumber - b.slotNumber);

    return NextResponse.json({
      success: true,
      data: {
        stationId,
        isOnline: true,
        totalSlots: dbStation.total_slots,
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
});
