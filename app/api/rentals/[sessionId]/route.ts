// API Route: Get session status and details
// GET /api/rentals/[sessionId]

import { NextRequest, NextResponse } from 'next/server';
import { sessionRepository } from '@/lib/db';
import { withPublicApi } from '@/lib/api/public-route';
import {
  authorizeSessionAccess,
  denyUuidLookupWithoutAuth,
  extractSessionToken,
  toPublicSessionView,
} from '@/lib/security/session-access';
import { estimateRentalChargeEur } from '@/lib/rental/charge-estimate';
import { normalizeSessionReward } from '@/lib/mappers/domain-mappers';

export const GET = withPublicApi(async (
  request: NextRequest,
  context?: { params: Promise<{ sessionId: string }> },
) => {
  try {
    const { sessionId } = await context!.params;

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

    const token = extractSessionToken(request);
    const access = await authorizeSessionAccess(request, session);
    const isFullAccess = access.authorized;

    const uuidDenied = denyUuidLookupWithoutAuth(sessionId, isFullAccess);
    if (uuidDenied) return uuidDenied;

    if (!isFullAccess) {
      return NextResponse.json({
        success: true,
        session: toPublicSessionView(session, {
          currentDurationMinutes: session.duration_minutes || 0,
          currentCharge: session.amount_charged,
        }),
      });
    }

    let currentDurationMinutes = session.duration_minutes || 0;
    let currentCharge = session.amount_charged;

    if (session.status === 'active' && session.started_at) {
      const startedAt = new Date(session.started_at);
      const now = new Date();
      currentDurationMinutes = Math.floor((now.getTime() - startedAt.getTime()) / 60000);
      currentCharge = estimateRentalChargeEur(currentDurationMinutes);
    }

    let events: Awaited<ReturnType<typeof sessionRepository.getEvents>> = [];
    try {
      events = await sessionRepository.getEvents(session.id);
    } catch (eventError) {
      console.warn('[API] Session events unavailable', {
        sessionId: session.id,
        error: eventError instanceof Error ? eventError.message : String(eventError),
      });
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        sessionCode: session.session_code,
        status: session.status,
        pickupStation: session.pickup_station ? {
          id: session.pickup_station.id,
          name: session.pickup_station.name,
          location: session.pickup_station.location,
        } : null,
        pickupSlotNumber: session.pickup_slot_number,
        returnStation: session.return_station ? {
          id: session.return_station.id,
          name: session.return_station.name,
          location: session.return_station.location,
        } : null,
        returnSlotNumber: session.return_slot_number,
        userEmail: session.user?.email,
        userName: session.user?.name,
        startedAt: session.started_at,
        endedAt: session.ended_at,
        currentDurationMinutes,
        depositAmount: session.deposit_amount,
        hourlyRate: session.hourly_rate,
        dailyCap: session.daily_cap,
        currentCharge: Math.round((currentCharge ?? 0) * 100) / 100,
        amountCharged: session.amount_charged,
        amountRefunded: session.amount_refunded,
        paymentStatus: session.payment_status,
        rewardQualified: session.reward_qualified,
        rewardStatus: session.reward_status,
        rewardThresholdMinutes: session.reward_threshold_minutes,
        reward: (() => {
          const reward = normalizeSessionReward(session.reward);
          return reward ? {
            id: reward.id,
            code: reward.code,
            type: reward.reward_type,
            value: reward.value,
            description: reward.description,
            status: reward.status,
            expiresAt: reward.expires_at,
            redeemedAt: reward.redeemed_at,
          } : null;
        })(),
        powerBankId: session.power_bank_id,
        events: events.map(e => ({
          id: e.id,
          type: e.event_type,
          description: e.description,
          timestamp: e.created_at,
          metadata: e.metadata,
        })),
        hasSessionToken: Boolean(token && session.unlock_token),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API] Error getting session:', { message, error });
    return NextResponse.json(
      { success: false, error: 'Failed to get session', code: 'SESSION_LOOKUP_ERROR' },
      { status: 500 }
    );
  }
}, 'sessionLookup');
