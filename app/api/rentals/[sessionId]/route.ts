// API Route: Get session status and details
// GET /api/rentals/[sessionId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { sessionRepository } from '@/lib/db';
import { withPublicApi } from '@/lib/api/public-route';

export const GET = withPublicApi(async (
  request: NextRequest,
  context?: { params: Promise<{ sessionId: string }> },
) => {
  try {
    const { sessionId } = await context!.params;

    // Try to find by ID first, then by session code
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

    // Calculate current duration if active
    let currentDurationMinutes = session.duration_minutes || 0;
    let currentCharge = session.amount_charged;
    
    if (session.status === 'active' && session.started_at) {
      const startedAt = new Date(session.started_at);
      const now = new Date();
      currentDurationMinutes = Math.floor((now.getTime() - startedAt.getTime()) / 60000);
      
      // Calculate running charge
      const hourlyCharge = (currentDurationMinutes / 60) * session.hourly_rate;
      currentCharge = Math.min(hourlyCharge, session.daily_cap);
    }

    // Get timeline events
    const events = await sessionRepository.getEvents(session.id);

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        sessionCode: session.session_code,
        status: session.status,
        
        // Station info
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
        
        // User info
        userEmail: session.user?.email,
        userName: session.user?.name,
        
        // Timing
        startedAt: session.started_at,
        endedAt: session.ended_at,
        currentDurationMinutes,
        
        // Payment
        depositAmount: session.deposit_amount,
        hourlyRate: session.hourly_rate,
        dailyCap: session.daily_cap,
        currentCharge: Math.round(currentCharge * 100) / 100,
        amountCharged: session.amount_charged,
        amountRefunded: session.amount_refunded,
        paymentStatus: session.payment_status,
        
        // Reward
        rewardQualified: session.reward_qualified,
        rewardStatus: session.reward_status,
        rewardThresholdMinutes: session.reward_threshold_minutes,
        reward: session.reward ? {
          id: session.reward.id,
          code: session.reward.code,
          type: session.reward.reward_type,
          value: session.reward.value,
          description: session.reward.description,
          status: session.reward.status,
          expiresAt: session.reward.expires_at,
          redeemedAt: session.reward.redeemed_at,
        } : null,
        
        // Power bank
        powerBankId: session.power_bank_id,
        
        // Timeline
        events: events.map(e => ({
          id: e.id,
          type: e.event_type,
          description: e.description,
          timestamp: e.created_at,
          metadata: e.metadata,
        })),
      },
    });
  } catch (error) {
    console.error('[API] Error getting session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get session' },
      { status: 500 }
    );
  }
});
