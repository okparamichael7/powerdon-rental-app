// API Route: Start a new rental session
// POST /api/rentals/start

import { NextRequest, NextResponse } from 'next/server';
import { sessionRepository, userRepository, stationRepository } from '@/lib/db';
import { enforceRateLimit } from '@/lib/api/route-helpers';
import { validateBody, schemas } from '@/lib/security/validation';
import { dispatchBorrowForSession } from '@/lib/rental/dispatch-borrow';
import { prepareRentalStart, loadCampaignPricing } from '@/lib/rental/start-orchestrator';
import { nullIfEmptyUuid } from '@/lib/db/schema-compat';
import { getErrorMessage } from '@/lib/errors/get-error-message';

export async function POST(request: NextRequest) {
  const rateLimited = await enforceRateLimit(request, 'rentalStart');
  if (rateLimited) return rateLimited;

  try {
    const validated = await validateBody(request, schemas.rentalStartPublic);
    if (!validated.success) return validated.error;

    const body = validated.data;
    const { stationId, slotNumber, userEmail, userName, phone, marketingConsent } = body;
    const campaignId = nullIfEmptyUuid(body.campaignId);

    const station = await stationRepository.getById(stationId);
    if (!station) {
      return NextResponse.json(
        { success: false, error: 'Station not found' },
        { status: 404 }
      );
    }

    if (station.status !== 'online') {
      return NextResponse.json(
        { success: false, error: 'Station is not available', stationStatus: station.status },
        { status: 400 }
      );
    }

    const user = await userRepository.getOrCreate(userEmail, {
      name: userName,
      phone,
      marketingConsent,
    });

    const existingSession = await sessionRepository.getActiveByUserId(user.id);
    if (existingSession) {
      return NextResponse.json(
        {
          success: false,
          error: 'You already have an active rental session',
          existingSessionId: existingSession.id,
          existingSessionCode: existingSession.session_code,
        },
        { status: 400 }
      );
    }

    let targetSlot: number;
    if (slotNumber) {
      const slot = await stationRepository.getSlot(stationId, slotNumber);
      if (!slot || slot.status !== 'occupied') {
        return NextResponse.json(
          { success: false, error: 'Requested slot is not available' },
          { status: 400 }
        );
      }
      targetSlot = slotNumber;
    } else {
      const availableSlot = await stationRepository.getAvailableSlot(stationId);
      if (!availableSlot) {
        return NextResponse.json(
          { success: false, error: 'No power banks available at this station' },
          { status: 400 }
        );
      }
      targetSlot = availableSlot.slot_number;
    }

    const pricing = await loadCampaignPricing(campaignId, station.campaign_id ?? null);

    let prepared;
    try {
      prepared = await prepareRentalStart({
        userId: user.id,
        stationId,
        slotNumber: targetSlot,
        campaignId: pricing.campaignId,
        depositAmount: pricing.depositAmount,
        hourlyRate: pricing.hourlyRate,
        dailyCap: pricing.dailyCap,
        rewardThresholdMinutes: pricing.rewardThresholdMinutes,
      });
    } catch (prepError) {
      const prepMessage = getErrorMessage(prepError);
      if (prepMessage === 'SLOT_NOT_AVAILABLE' || prepMessage === 'SLOT_RESERVE_FAILED') {
        return NextResponse.json(
          { success: false, error: 'No power banks available at this station' },
          { status: 400 }
        );
      }
      throw prepError;
    }

    const session = prepared.session;

    await sessionRepository.addEvent(session.id, {
      type: 'scan',
      description: `Rental initiated at ${station.name}`,
      metadata: {
        stationId,
        slotNumber: targetSlot,
        userEmail,
      },
    });

    const borrowResult = await dispatchBorrowForSession(session.id);
    const hardwareCommandSent = borrowResult.success && !borrowResult.skipped;

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        sessionCode: session.session_code,
        stationId: session.pickup_station_id,
        stationName: station.name,
        slotNumber: session.pickup_slot_number,
        status: session.status,
        depositAmount: session.deposit_amount,
        hourlyRate: session.hourly_rate,
        dailyCap: session.daily_cap,
        unlockToken: prepared.unlockToken,
        unlockExpiresAt: session.unlock_token_expires_at,
        paymentAuthorizationId: session.payment_authorization_id ?? session.payment_intent_id ?? '',
      },
      hardwareCommandSent,
      message: hardwareCommandSent
        ? 'Rental session created. Please pick up your power bank from the indicated slot.'
        : 'Rental session created. Waiting for station connection.',
    });
  } catch (error) {
    console.error('[API] Error starting rental:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) || 'Failed to start rental' },
      { status: 500 }
    );
  }
}
