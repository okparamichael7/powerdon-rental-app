// API Route: Cancel a pending session
// POST /api/rentals/[sessionId]/cancel

import { NextRequest, NextResponse } from 'next/server';
import { sessionRepository, stationRepository } from '@/lib/db';
import { withPublicApi } from '@/lib/api/public-route';
import { authorizeSessionAccess } from '@/lib/security/session-access';
import { cancelRentalPaymentHold } from '@/lib/rental/finalize-payment';
import { notifyDepositRefunded } from '@/lib/rental/notifications';

export const POST = withPublicApi(async (
  request: NextRequest,
  context?: { params: Promise<{ sessionId: string }> },
) => {
  try {
    const { sessionId: sessionIdParam } = await context!.params;
    let session = await sessionRepository.getById(sessionIdParam);
    if (!session) {
      session = await sessionRepository.getByCode(sessionIdParam);
    }

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    const access = await authorizeSessionAccess(request, session);
    if (!access.authorized) {
      return access.response;
    }

    if (session.status !== 'pending') {
      return NextResponse.json(
        {
          success: false,
          error: 'Can only cancel pending sessions',
          currentStatus: session.status,
        },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { reason } = body as { reason?: string };

    await stationRepository.updateSlot(session.pickup_station_id, session.pickup_slot_number, {
      status: 'occupied',
    });

    await cancelRentalPaymentHold(session, reason || 'user_cancelled');
    await sessionRepository.cancelSession(session.id, reason);

    await sessionRepository.addEvent(session.id, {
      type: 'admin',
      description: reason ? `Session cancelled: ${reason}` : 'Session cancelled by user',
      metadata: { reason },
    });

    if (session.user?.email) {
      await notifyDepositRefunded(session.user.email, session.deposit_amount);
    }

    return NextResponse.json({
      success: true,
      message: 'Session cancelled successfully',
    });
  } catch (error) {
    console.error('[API] Error cancelling session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel session' },
      { status: 500 }
    );
  }
}, 'api');
