// Unlock endpoint for rental flow
// POST /api/stations/[id]/unlock - Unlock a specific slot for rental

import { NextRequest, NextResponse } from 'next/server';
import { stationManager } from '@/lib/wscharge';
import * as protocol from '@/lib/wscharge/protocol';
import { withPublicApi } from '@/lib/api/public-route';

export const POST = withPublicApi(async (
  request: NextRequest,
  context?: { params: Promise<{ id: string }> },
) => {
  const { id: stationId } = await context!.params;
  
  try {
    const body = await request.json();
    const { slotNumber, sessionId } = body as { 
      slotNumber?: number;
      sessionId: string;
    };

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const station = stationManager.getStation(stationId);
    if (!station || !station.isOnline) {
      return NextResponse.json(
        { success: false, error: 'Station not connected' },
        { status: 503 }
      );
    }

    // If no slot specified, get the best available slot
    let targetSlot: number;
    if (typeof slotNumber === 'number') {
      targetSlot = slotNumber;
    } else {
      const bestSlot = stationManager.getBestAvailableSlot(stationId);
      if (!bestSlot) {
        return NextResponse.json(
          { success: false, error: 'No power banks available' },
          { status: 409 }
        );
      }
      targetSlot = bestSlot.slotNumber;
    }

    // Verify slot is available
    const slotInfo = station.inventory.find(s => s.slotNumber === targetSlot);
    if (!slotInfo) {
      return NextResponse.json(
        { success: false, error: 'Slot not available' },
        { status: 409 }
      );
    }

    // Send borrow command to station
    const payload = Buffer.alloc(1);
    payload.writeUInt8(targetSlot, 0);
    
    const result = await stationManager.sendCommand<protocol.BorrowResponse>(
      stationId,
      protocol.CommandCode.BORROW_POWERBANK,
      payload
    );

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'Failed to unlock power bank',
          code: 'UNLOCK_FAILED',
        },
        { status: 500 }
      );
    }

    const borrowResponse = result.data;
    
    if (!borrowResponse || borrowResponse.result !== protocol.BorrowResult.SUCCESS) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Power bank unlock failed at station',
          code: 'STATION_UNLOCK_FAILED',
        },
        { status: 500 }
      );
    }

    // Find updated slot info for battery level
    const batteryLevel = slotInfo.batteryLevel;

    return NextResponse.json({
      success: true,
      data: {
        stationId,
        sessionId,
        slotNumber: borrowResponse.slotNumber,
        terminalId: borrowResponse.terminalId,
        batteryLevel: protocol.batteryLevelToPercent(batteryLevel),
        formattedTerminalId: protocol.formatTerminalId(borrowResponse.terminalId),
        unlockedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Error unlocking power bank:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to unlock power bank' },
      { status: 500 }
    );
  }
});
