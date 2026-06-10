// Unlock endpoint for rental flow
// POST /api/stations/[id]/unlock

import { NextRequest, NextResponse } from 'next/server';
import { stationManager } from '@/lib/wscharge';
import * as protocol from '@/lib/wscharge/protocol';
import { sessionRepository, stationRepository } from '@/lib/db';
import { resolveDbStationId } from '@/lib/db/station-resolve';
import { withPublicApi } from '@/lib/api/public-route';
import { authorizeSessionAccess } from '@/lib/security/session-access';
import { validateBody, schemas } from '@/lib/security/validation';
import { canDispatchHardwareToStation } from '@/lib/rental/hardware-dispatch-guard';

export const POST = withPublicApi(async (
  request: NextRequest,
  context?: { params: Promise<{ id: string }> },
) => {
  const { id: stationId } = await context!.params;

  try {
    const validated = await validateBody(request, schemas.unlockRequest);
    if (!validated.success) return validated.error;

    const { slotNumber, sessionId, unlockToken } = validated.data;

    const session = await sessionRepository.getByIdOrCode(sessionId);
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

    const dbStationId = await resolveDbStationId(stationId);
    if (!dbStationId) {
      return NextResponse.json(
        { success: false, error: 'Station not found' },
        { status: 404 }
      );
    }

    if (session.pickup_station_id !== dbStationId) {
      return NextResponse.json(
        { success: false, error: 'Session does not belong to this station' },
        { status: 400 }
      );
    }

    const dbStation = await stationRepository.getById(dbStationId);
    if (!dbStation?.external_id) {
      return NextResponse.json(
        { success: false, error: 'Station hardware not configured' },
        { status: 503 }
      );
    }

    const dispatchGuard = canDispatchHardwareToStation(dbStation);
    if (!dispatchGuard.allowed) {
      return NextResponse.json(
        { success: false, error: dispatchGuard.error || 'Station not connected', code: 'STATION_OFFLINE' },
        { status: 503 }
      );
    }

    let targetSlot: number;
    if (typeof slotNumber === 'number') {
      targetSlot = slotNumber;
    } else if (session.pickup_slot_number) {
      targetSlot = session.pickup_slot_number;
    } else {
      const availableSlot = await stationRepository.getAvailableSlot(stationId);
      if (!availableSlot) {
        return NextResponse.json(
          { success: false, error: 'No power banks available' },
          { status: 409 }
        );
      }
      targetSlot = availableSlot.slot_number;
    }

    const dbSlot = dbStation.slots.find((s) => s.slot_number === targetSlot);
    if (!dbSlot || !['occupied', 'reserved'].includes(dbSlot.status)) {
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
        { status: result.error?.includes('not connected') ? 503 : 500 }
      );
    }

    if (result.proxyOnly || !result.data) {
      await stationRepository.createCommand({
        station_id: dbStation.id,
        command_type: 'borrow',
        slot_number: targetSlot,
        payload: { sessionCode: session.session_code },
        status: 'sent',
        priority: 1,
        session_id: session.id,
        metadata: { source: 'unlock-api', proxyOnly: true },
      });

      await sessionRepository.addEvent(session.id, {
        type: 'unlock',
        description: `Unlock command dispatched for slot ${targetSlot}`,
        metadata: { slotNumber: targetSlot, source: 'unlock-api', proxyOnly: true },
      });

      return NextResponse.json({
        success: true,
        data: {
          stationId: dbStationId,
          sessionId: session.id,
          slotNumber: targetSlot,
          terminalId: dbSlot.power_bank_id ?? '',
          batteryLevel: dbSlot.battery_level ?? 0,
          formattedTerminalId: dbSlot.power_bank_id ?? '',
          unlockedAt: new Date().toISOString(),
          proxyDispatched: true,
        },
      });
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

    const batteryLevel = dbSlot.battery_level ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        stationId: dbStationId,
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
