// Unlock endpoint for rental flow
// POST /api/stations/[id]/unlock

import { NextRequest, NextResponse } from 'next/server';
import { stationManager } from '@/lib/wscharge';
import * as protocol from '@/lib/wscharge/protocol';
import { sessionRepository, stationRepository } from '@/lib/db';
import { withPublicApi } from '@/lib/api/public-route';
import { authorizeSessionAccess } from '@/lib/security/session-access';

export const POST = withPublicApi(async (
  request: NextRequest,
  context?: { params: Promise<{ id: string }> },
) => {
  const { id: stationId } = await context!.params;

  try {
    const body = await request.json();
    const { slotNumber, sessionId, unlockToken } = body as {
      slotNumber?: number;
      sessionId: string;
      unlockToken?: string;
    };

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    let session = await sessionRepository.getById(sessionId);
    if (!session) {
      session = await sessionRepository.getByCode(sessionId);
    }
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    const access = await authorizeSessionAccess(request, session, unlockToken);
    if (!access.authorized) {
      return access.response;
    }

    if (
      process.env.STRIPE_SECRET_KEY &&
      session.payment_intent_id &&
      session.payment_status !== 'authorized' &&
      session.payment_status !== 'captured'
    ) {
      return NextResponse.json(
        { success: false, error: 'Payment authorization required', code: 'PAYMENT_REQUIRED' },
        { status: 402 }
      );
    }

    if (!['pending', 'active'].includes(session.status)) {
      return NextResponse.json(
        { success: false, error: 'Session is not eligible for unlock', code: 'INVALID_STATUS' },
        { status: 400 }
      );
    }

    if (session.pickup_station_id !== stationId) {
      return NextResponse.json(
        { success: false, error: 'Session does not belong to this station' },
        { status: 400 }
      );
    }

    const dbStation = await stationRepository.getById(stationId);
    if (!dbStation?.external_id) {
      return NextResponse.json(
        { success: false, error: 'Station hardware not configured' },
        { status: 503 }
      );
    }

    const connection = stationManager.getStation(dbStation.external_id);
    if (!connection || !connection.isOnline) {
      return NextResponse.json(
        { success: false, error: 'Station not connected' },
        { status: 503 }
      );
    }

    let targetSlot: number;
    if (typeof slotNumber === 'number') {
      targetSlot = slotNumber;
    } else if (session.pickup_slot_number) {
      targetSlot = session.pickup_slot_number;
    } else {
      const bestSlot = stationManager.getBestAvailableSlot(dbStation.external_id);
      if (!bestSlot) {
        return NextResponse.json(
          { success: false, error: 'No power banks available' },
          { status: 409 }
        );
      }
      targetSlot = bestSlot.slotNumber;
    }

    const slotInfo = connection.inventory.find(s => s.slotNumber === targetSlot);
    if (!slotInfo) {
      return NextResponse.json(
        { success: false, error: 'Slot not available' },
        { status: 409 }
      );
    }

    const payload = Buffer.alloc(1);
    payload.writeUInt8(targetSlot, 0);

    const result = await stationManager.sendCommand<protocol.BorrowResponse>(
      dbStation.external_id,
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

    const batteryLevel = slotInfo.batteryLevel;

    return NextResponse.json({
      success: true,
      data: {
        stationId,
        sessionId: session.id,
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
