// Station management API routes - handles hardware commands via HTTP
// Note: The actual TCP server needs to run separately and communicate with this API

import { NextResponse } from 'next/server';
import { stationManager } from '@/lib/wscharge';
import * as protocol from '@/lib/wscharge/protocol';

export async function GET() {
  try {
    const stations = stationManager.getConnectedStations();
    
    return NextResponse.json({
      success: true,
      data: stations.map(station => ({
        stationId: station.stationId,
        productSn: station.productSn,
        isOnline: station.isOnline,
        connectedAt: station.connectedAt.toISOString(),
        lastHeartbeat: station.lastHeartbeat.toISOString(),
        lastInventoryUpdate: station.lastInventoryUpdate?.toISOString() || null,
        signalStrength: station.signalStrength,
        iccid: station.iccid,
        firmwareVersion: station.firmwareVersion,
        availableSlots: station.inventory.length,
        inventory: station.inventory.map(slot => ({
          slotNumber: slot.slotNumber,
          terminalId: protocol.formatTerminalId(slot.terminalId),
          batteryLevel: protocol.batteryLevelToPercent(slot.batteryLevel),
        })),
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error fetching stations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch station data' },
      { status: 500 }
    );
  }
}
