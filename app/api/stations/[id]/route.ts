// Individual station API route - get station details and send commands
import { NextRequest, NextResponse } from 'next/server';
import { stationManager } from '@/lib/wscharge';
import * as protocol from '@/lib/wscharge/protocol';

// GET /api/stations/[id] - Get station details
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

    return NextResponse.json({
      success: true,
      data: {
        stationId: station.stationId,
        productSn: station.productSn,
        isOnline: station.isOnline,
        connectedAt: station.connectedAt.toISOString(),
        lastHeartbeat: station.lastHeartbeat.toISOString(),
        lastInventoryUpdate: station.lastInventoryUpdate?.toISOString() || null,
        signalStrength: station.signalStrength,
        iccid: station.iccid,
        firmwareVersion: station.firmwareVersion,
        inventory: station.inventory.map(slot => ({
          slotNumber: slot.slotNumber,
          terminalId: protocol.formatTerminalId(slot.terminalId),
          batteryLevel: protocol.batteryLevelToPercent(slot.batteryLevel),
        })),
        pendingCommands: station.pendingCommands.length,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching station:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch station data' },
      { status: 500 }
    );
  }
}

// POST /api/stations/[id] - Send command to station
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stationId } = await params;
  
  try {
    const body = await request.json();
    const { command, slotNumber } = body as { 
      command: 'query_inventory' | 'borrow' | 'force_eject' | 'full_eject' | 'reboot' | 'query_info';
      slotNumber?: number;
    };

    if (!command) {
      return NextResponse.json(
        { success: false, error: 'Command is required' },
        { status: 400 }
      );
    }

    let result: { success: boolean; data?: unknown; error?: string; commandBuffer: Buffer };
    let payload: Buffer | undefined;

    switch (command) {
      case 'query_inventory':
        result = await stationManager.sendCommand(
          stationId, 
          protocol.CommandCode.QUERY_INVENTORY
        );
        break;

      case 'borrow':
        if (typeof slotNumber !== 'number') {
          return NextResponse.json(
            { success: false, error: 'Slot number is required for borrow command' },
            { status: 400 }
          );
        }
        payload = Buffer.alloc(1);
        payload.writeUInt8(slotNumber, 0);
        result = await stationManager.sendCommand(
          stationId, 
          protocol.CommandCode.BORROW_POWERBANK,
          payload
        );
        break;

      case 'force_eject':
        if (typeof slotNumber !== 'number') {
          return NextResponse.json(
            { success: false, error: 'Slot number is required for force_eject command' },
            { status: 400 }
          );
        }
        payload = Buffer.alloc(1);
        payload.writeUInt8(slotNumber, 0);
        result = await stationManager.sendCommand(
          stationId, 
          protocol.CommandCode.FORCE_EJECT,
          payload
        );
        break;

      case 'full_eject':
        result = await stationManager.sendCommand(
          stationId, 
          protocol.CommandCode.FORCE_EJECT
        );
        break;

      case 'reboot':
        result = await stationManager.sendCommand(
          stationId, 
          protocol.CommandCode.REMOTE_REBOOT
        );
        break;

      case 'query_info':
        result = await stationManager.sendCommand(
          stationId, 
          protocol.CommandCode.QUERY_NETWORK_INFO
        );
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown command' },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      command,
      stationId,
    });
  } catch (error) {
    console.error('[API] Error sending command:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send command' },
      { status: 500 }
    );
  }
}
