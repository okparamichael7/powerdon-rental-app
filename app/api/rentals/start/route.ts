// API Route: Start a new rental session
// POST /api/rentals/start

import { NextRequest, NextResponse } from 'next/server';
import { sessionRepository, userRepository, stationRepository, campaignRepository } from '@/lib/db';
import { enforceRateLimit } from '@/lib/api/route-helpers';
import { validateBody, schemas } from '@/lib/security/validation';
import { stationManager } from '@/lib/wscharge';
import * as protocol from '@/lib/wscharge/protocol';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const rateLimited = await enforceRateLimit(request, 'rentalStart');
  if (rateLimited) return rateLimited;

  try {
    const validated = await validateBody(request, schemas.rentalStartPublic);
    if (!validated.success) return validated.error;

    const body = validated.data;
    const { stationId, slotNumber, userEmail, userName, phone, marketingConsent } = body;
    let { campaignId } = body;

    // Get station from database
    const station = await stationRepository.getById(stationId);
    if (!station) {
      return NextResponse.json(
        { success: false, error: 'Station not found' },
        { status: 404 }
      );
    }

    // Check station is online
    if (station.status !== 'online') {
      return NextResponse.json(
        { success: false, error: 'Station is not available', stationStatus: station.status },
        { status: 400 }
      );
    }

    // Get or create user
    const user = await userRepository.getOrCreate(userEmail, {
      name: userName,
      phone,
      marketingConsent,
    });

    // Check if user already has an active session
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

    // Find available slot
    let targetSlot: number;
    if (slotNumber) {
      // User requested specific slot
      const slot = await stationRepository.getSlot(stationId, slotNumber);
      if (!slot || slot.status !== 'occupied') {
        return NextResponse.json(
          { success: false, error: 'Requested slot is not available' },
          { status: 400 }
        );
      }
      targetSlot = slotNumber;
    } else {
      // Find best available slot (highest battery)
      const availableSlot = await stationRepository.getAvailableSlot(stationId);
      if (!availableSlot) {
        return NextResponse.json(
          { success: false, error: 'No power banks available at this station' },
          { status: 400 }
        );
      }
      targetSlot = availableSlot.slot_number;
    }

    // Reserve the slot
    const reserved = await stationRepository.reserveSlot(stationId, targetSlot);
    if (!reserved) {
      return NextResponse.json(
        { success: false, error: 'Failed to reserve slot, please try again' },
        { status: 400 }
      );
    }

    let depositAmount = 25.00;
    let hourlyRate = 2.00;
    let dailyCap = 10.00;
    let rewardThresholdMinutes = 60;

    if (campaignId) {
      const campaign = await campaignRepository.getById(campaignId);
      if (campaign?.is_active) {
        depositAmount = Number(campaign.deposit_amount);
        hourlyRate = Number(campaign.hourly_rate);
        dailyCap = Number(campaign.daily_cap);
        rewardThresholdMinutes = campaign.reward_threshold_minutes;
      }
    } else if (station.campaign_id) {
      const campaign = await campaignRepository.getById(station.campaign_id);
      if (campaign?.is_active) {
        depositAmount = Number(campaign.deposit_amount);
        hourlyRate = Number(campaign.hourly_rate);
        dailyCap = Number(campaign.daily_cap);
        rewardThresholdMinutes = campaign.reward_threshold_minutes;
        campaignId = campaign.id;
      }
    }

    // Generate unlock token
    const unlockToken = crypto.randomBytes(16).toString('hex');
    const unlockTokenExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Create session in database
    const session = await sessionRepository.create({
      userId: user.id,
      campaignId,
      pickupStationId: stationId,
      pickupSlotNumber: targetSlot,
      depositAmount,
      hourlyRate,
      dailyCap,
      rewardThresholdMinutes,
      unlockToken,
      unlockTokenExpiresAt,
    });

    // Add initial timeline event
    await sessionRepository.addEvent(session.id, {
      type: 'scan',
      description: `Rental initiated at ${station.name}`,
      metadata: { 
        stationId, 
        slotNumber: targetSlot,
        userEmail,
      },
    });

    // Send unlock command to hardware
    let hardwareCommandSent = false;
    if (station.external_id) {
      try {
        const payload = Buffer.alloc(1);
        payload.writeUInt8(targetSlot, 0);
        const result = await stationManager.sendCommand(
          station.external_id,
          protocol.CommandCode.BORROW_POWERBANK,
          payload,
        );
        hardwareCommandSent = result.success;

        if (result.success) {
          // Record command in database
          await stationRepository.createCommand({
            station_id: stationId,
            command_type: 'borrow',
            slot_number: targetSlot,
            payload: { sessionCode: session.session_code },
            status: 'sent',
            priority: 1,
            session_id: session.id,
            metadata: {},
          });

          await sessionRepository.addEvent(session.id, {
            type: 'unlock',
            description: `Unlock command sent for slot ${targetSlot}`,
            metadata: { slotNumber: targetSlot },
          });
        }
      } catch (hwError) {
        console.error('[Rental] Error sending hardware command:', hwError);
      }
    }

    // If hardware command wasn't sent (station not connected), session stays pending
    // The TCP proxy will handle the response when it comes

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
        unlockToken: session.unlock_token,
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
      { success: false, error: error instanceof Error ? error.message : 'Failed to start rental' },
      { status: 500 }
    );
  }
}
