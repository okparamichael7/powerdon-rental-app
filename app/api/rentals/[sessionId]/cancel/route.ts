// API Route: Cancel a pending session
// POST /api/rentals/[sessionId]/cancel

import { NextRequest, NextResponse } from 'next/server';
import { sessionRepository, stationRepository } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    // Get the session
    const session = await sessionRepository.getById(sessionId);
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Can only cancel pending sessions
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

    // Release the reserved slot
    await stationRepository.updateSlot(session.pickup_station_id, session.pickup_slot_number, {
      status: 'occupied', // Return to occupied
    });

    // Cancel the session
    await sessionRepository.cancelSession(session.id, reason);

    // Add timeline event
    await sessionRepository.addEvent(session.id, {
      type: 'admin',
      description: reason ? `Session cancelled: ${reason}` : 'Session cancelled by user',
      metadata: { reason },
    });

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
}
