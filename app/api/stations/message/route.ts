// Message handler for processing raw WsCharge protocol messages
// This endpoint can be called by a TCP proxy to process station messages
// POST /api/stations/message

import { NextRequest, NextResponse } from 'next/server';
import { stationManager } from '@/lib/wscharge';
import * as protocol from '@/lib/wscharge/protocol';
import { stationRepository, sessionRepository, rewardRepository } from '@/lib/db';
import type { SlotStatus } from '@/lib/db/types';

// Verify request is from TCP proxy (optional security)
function verifyProxyRequest(request: NextRequest): boolean {
  const proxyHeader = request.headers.get('x-station-proxy');
  
  // In development, allow all requests
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  // In production, require proxy header or API key
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.STATION_PROXY_TOKEN;
  
  return proxyHeader === 'true' || (expectedToken && authHeader === `Bearer ${expectedToken}`);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stationId, messageHex, connectionId, remoteAddress } = body as {
      stationId?: string;
      messageHex: string;
      connectionId?: string;
      remoteAddress?: string;
    };

    if (!messageHex) {
      return NextResponse.json(
        { success: false, error: 'messageHex is required' },
        { status: 400 }
      );
    }

    // Parse hex string to buffer
    const messageBuffer = Buffer.from(messageHex, 'hex');
    
    // Extract all complete messages
    const { messages, remaining } = protocol.extractMessages(messageBuffer);

    const responses: { command: string; responseHex: string; data?: Record<string, unknown> }[] = [];
    let currentStationId = stationId;
    let dbStationId: string | null = null;

    for (const message of messages) {
      let responseBuffer: Buffer | null = null;
      let responseData: Record<string, unknown> | undefined;

      switch (message.command) {
        case protocol.CommandCode.LOGIN: {
          const loginMsg = protocol.parseLoginMessage(message);
          if (loginMsg) {
            currentStationId = loginMsg.productSn;
            const { response } = stationManager.handleLogin(loginMsg);
            responseBuffer = response;

            // Register or update station in database
            try {
              const station = await stationRepository.registerFromHardware(loginMsg.productSn, {
                iccid: loginMsg.iccid,
                firmwareVersion: loginMsg.firmwareVersion,
                connectionIp: remoteAddress,
                totalSlots: loginMsg.slotCount,
              });
              dbStationId = station.id;

              // Log the hardware event
              await stationRepository.logHardwareEvent({
                station_id: station.id,
                station_external_id: loginMsg.productSn,
                event_type: 'login',
                direction: 'inbound',
                raw_data: messageHex,
                parsed_data: {
                  productSn: loginMsg.productSn,
                  iccid: loginMsg.iccid,
                  firmwareVersion: loginMsg.firmwareVersion,
                  slotCount: loginMsg.slotCount,
                },
              });
            } catch (dbError) {
              console.error('[DB] Error registering station:', dbError);
            }
            
            responseData = {
              stationId: loginMsg.productSn,
              dbStationId,
              action: 'login',
              result: 'success',
            };
          }
          break;
        }

        case protocol.CommandCode.HEARTBEAT: {
          if (currentStationId) {
            responseBuffer = stationManager.handleHeartbeat(currentStationId);
            
            // Update heartbeat in database
            if (dbStationId) {
              try {
                await stationRepository.updateHeartbeat(dbStationId, {
                  connectionIp: remoteAddress,
                });
              } catch (dbError) {
                console.error('[DB] Error updating heartbeat:', dbError);
              }
            }
            
            responseData = {
              stationId: currentStationId,
              action: 'heartbeat',
            };
          }
          break;
        }

        case protocol.CommandCode.QUERY_INVENTORY: {
          if (currentStationId) {
            const inventoryResponse = protocol.parseInventoryResponse(message);
            if (inventoryResponse) {
              stationManager.handleInventoryResponse(currentStationId, inventoryResponse);
              
              // Update inventory in database
              if (dbStationId && inventoryResponse.slots) {
                try {
                  const inventory = inventoryResponse.slots.map((slot) => ({
                    slotNumber: slot.slotNumber,
                    status: mapHardwareSlotStatus(slot.status),
                    batteryLevel: slot.batteryLevel,
                    powerBankId: slot.terminalId,
                    isCharging: slot.isCharging,
                  }));
                  await stationRepository.updateInventory(dbStationId, inventory);

                  // Log the event
                  await stationRepository.logHardwareEvent({
                    station_id: dbStationId,
                    event_type: 'inventory',
                    direction: 'inbound',
                    raw_data: messageHex,
                    parsed_data: inventoryResponse,
                  });
                } catch (dbError) {
                  console.error('[DB] Error updating inventory:', dbError);
                }
              }
              
              responseData = {
                stationId: currentStationId,
                action: 'inventory_updated',
                slotCount: inventoryResponse.remainingCount,
              };
            }
          }
          // No response needed - this is the cabinet's response to our query
          break;
        }

        case protocol.CommandCode.RETURN_POWERBANK: {
          if (currentStationId) {
            const returnMsg = protocol.parseReturnMessage(message);
            if (returnMsg) {
              responseBuffer = stationManager.handleReturn(currentStationId, returnMsg);
              
              // Process return in database
              if (dbStationId) {
                try {
                  await processReturn(dbStationId, returnMsg);
                  
                  // Log the event
                  await stationRepository.logHardwareEvent({
                    station_id: dbStationId,
                    event_type: 'return',
                    direction: 'inbound',
                    raw_data: messageHex,
                    parsed_data: returnMsg,
                  });
                } catch (dbError) {
                  console.error('[DB] Error processing return:', dbError);
                }
              }
              
              responseData = {
                stationId: currentStationId,
                action: 'powerbank_returned',
                slotNumber: returnMsg.slotNumber,
                terminalId: returnMsg.terminalId,
              };
            }
          }
          break;
        }

        case protocol.CommandCode.BORROW_POWERBANK: {
          if (currentStationId) {
            const borrowResponse = protocol.parseBorrowResponse(message);
            if (borrowResponse) {
              stationManager.handleBorrowResponse(currentStationId, borrowResponse);
              
              const success = borrowResponse.result === protocol.BorrowResult.SUCCESS;
              
              // Process borrow result in database
              if (dbStationId) {
                try {
                  await processBorrowResult(dbStationId, borrowResponse);
                  
                  // Log the event
                  await stationRepository.logHardwareEvent({
                    station_id: dbStationId,
                    event_type: 'borrow',
                    direction: 'inbound',
                    raw_data: messageHex,
                    parsed_data: borrowResponse,
                  });
                } catch (dbError) {
                  console.error('[DB] Error processing borrow result:', dbError);
                }
              }
              
              responseData = {
                stationId: currentStationId,
                action: 'borrow_response',
                slotNumber: borrowResponse.slotNumber,
                success,
                terminalId: borrowResponse.terminalId,
              };
            }
          }
          // No response needed - this is the cabinet's response to our borrow command
          break;
        }

        case protocol.CommandCode.FORCE_EJECT: {
          if (currentStationId) {
            const ejectResponse = protocol.parseForceEjectResponse(message);
            if (ejectResponse) {
              stationManager.handleForceEjectResponse(currentStationId, ejectResponse);
              
              // Log the event
              if (dbStationId) {
                try {
                  await stationRepository.logHardwareEvent({
                    station_id: dbStationId,
                    event_type: 'force_eject',
                    direction: 'inbound',
                    raw_data: messageHex,
                    parsed_data: ejectResponse,
                  });
                } catch (dbError) {
                  console.error('[DB] Error logging force eject:', dbError);
                }
              }
              
              responseData = {
                stationId: currentStationId,
                action: 'force_eject_response',
                slotNumber: ejectResponse.slotNumber,
                success: ejectResponse.result === protocol.BorrowResult.SUCCESS,
              };
            }
          }
          break;
        }

        default:
          console.log('[WsCharge] Unhandled command:', message.command.toString(16));
      }

      if (responseBuffer) {
        responses.push({
          command: protocol.CommandCode[message.command] || `0x${message.command.toString(16)}`,
          responseHex: responseBuffer.toString('hex'),
          data: responseData,
        });
      } else if (responseData) {
        responses.push({
          command: protocol.CommandCode[message.command] || `0x${message.command.toString(16)}`,
          responseHex: '',
          data: responseData,
        });
      }
    }

    return NextResponse.json({
      success: true,
      stationId: currentStationId,
      dbStationId,
      connectionId,
      messagesProcessed: messages.length,
      responses,
      remainingBytes: remaining.length > 0 ? remaining.toString('hex') : null,
    });
  } catch (error) {
    console.error('[API] Error processing message:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process message' },
      { status: 500 }
    );
  }
}

// Map hardware slot status to database enum
function mapHardwareSlotStatus(status: number): SlotStatus {
  switch (status) {
    case 0:
      return 'empty';
    case 1:
      return 'occupied';
    case 2:
      return 'reserved';
    case 3:
      return 'error';
    case 4:
      return 'disabled';
    default:
      return 'empty';
  }
}

// Process a borrow (unlock) result from the hardware
async function processBorrowResult(
  stationId: string,
  borrowResponse: {
    slotNumber: number;
    result: number;
    terminalId?: string;
    orderNumber?: string;
  }
) {
  const success = borrowResponse.result === protocol.BorrowResult.SUCCESS;
  const { slotNumber, terminalId, orderNumber } = borrowResponse;

  // Find the pending session for this slot
  // We may have stored the orderNumber as the session code
  const sessions = await sessionRepository.getAll({
    stationId,
    status: ['pending'],
    limit: 10,
  });

  const session = sessions.find(
    s => s.pickup_station_id === stationId && 
         s.pickup_slot_number === slotNumber
  );

  if (!session) {
    console.warn('[Borrow] No pending session found for:', { stationId, slotNumber, orderNumber });
    return;
  }

  if (success) {
    // Start the session
    await sessionRepository.startSession(session.id, terminalId);
    
    // Update slot status to empty
    await stationRepository.updateSlot(stationId, slotNumber, {
      status: 'empty',
      power_bank_id: null,
    });

    // Add timeline event
    await sessionRepository.addEvent(session.id, {
      type: 'pickup',
      description: `Power bank ${terminalId || 'unknown'} picked up from slot ${slotNumber}`,
      metadata: { slotNumber, powerBankId: terminalId },
    });

    console.log('[Borrow] Session started:', session.id);
  } else {
    // Mark session as failed
    await sessionRepository.update(session.id, {
      status: 'failed',
      payment_status: 'cancelled',
      metadata: { 
        failureReason: 'hardware_unlock_failed',
        borrowResult: borrowResponse.result,
      },
    });

    // Release the slot reservation
    await stationRepository.updateSlot(stationId, slotNumber, {
      status: 'occupied', // Return to occupied since power bank is still there
    });

    // Add timeline event
    await sessionRepository.addEvent(session.id, {
      type: 'error',
      description: `Failed to unlock slot ${slotNumber}: error code ${borrowResponse.result}`,
      metadata: { slotNumber, errorCode: borrowResponse.result },
    });

    console.log('[Borrow] Session failed:', session.id, 'result:', borrowResponse.result);
  }
}

// Process a return detected by the hardware
async function processReturn(
  stationId: string,
  returnMsg: {
    slotNumber: number;
    terminalId?: string;
    batteryLevel?: number;
  }
) {
  const { slotNumber, terminalId, batteryLevel } = returnMsg;

  // Update slot status
  await stationRepository.updateSlot(stationId, slotNumber, {
    status: 'occupied',
    power_bank_id: terminalId,
    battery_level: batteryLevel,
    is_charging: true,
  });

  // Find active session with this power bank
  if (!terminalId) {
    console.log('[Return] No terminal ID provided, cannot match to session');
    return;
  }

  const activeSessions = await sessionRepository.getAll({
    status: ['active'],
    limit: 100,
  });

  const session = activeSessions.find(s => s.power_bank_id === terminalId);

  if (!session) {
    console.log('[Return] No active session found for power bank:', terminalId);
    return;
  }

  // Calculate duration and charges
  const startedAt = session.started_at ? new Date(session.started_at) : new Date(session.created_at);
  const now = new Date();
  const durationMinutes = Math.floor((now.getTime() - startedAt.getTime()) / 60000);
  
  // Calculate charge using daily cap
  const hourlyCharge = (durationMinutes / 60) * session.hourly_rate;
  const amountCharged = Math.min(hourlyCharge, session.daily_cap);
  const amountRefunded = session.deposit_amount; // Full deposit refund

  // Check if reward is qualified
  const rewardQualified = session.reward_threshold_minutes 
    ? durationMinutes >= session.reward_threshold_minutes 
    : false;

  // Complete the session
  await sessionRepository.completeSession(session.id, {
    returnStationId: stationId,
    returnSlotNumber: slotNumber,
    durationMinutes,
    amountCharged: Math.round(amountCharged * 100) / 100,
    amountRefunded,
    rewardQualified,
  });

  // Add timeline event
  await sessionRepository.addEvent(session.id, {
    type: 'return',
    description: `Power bank returned to slot ${slotNumber}`,
    metadata: { 
      stationId, 
      slotNumber, 
      batteryLevel,
      durationMinutes,
      amountCharged: Math.round(amountCharged * 100) / 100,
    },
  });

  // If reward qualified, create reward
  if (rewardQualified && session.campaign_id) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 day expiry

    try {
      const reward = await rewardRepository.create({
        sessionId: session.id,
        userId: session.user_id,
        campaignId: session.campaign_id,
        rewardType: 'voucher', // Would come from campaign
        value: 10, // Would come from campaign
        description: 'Thank you for using PowerDon!',
        expiresAt,
      });

      // Update session with reward
      await sessionRepository.update(session.id, {
        reward_id: reward.id,
        reward_status: 'qualified',
      });

      // Add reward event
      await sessionRepository.addEvent(session.id, {
        type: 'reward',
        description: `Reward qualified: ${reward.code}`,
        metadata: { rewardId: reward.id, rewardCode: reward.code },
      });

      console.log('[Return] Reward created:', reward.code);
    } catch (rewardError) {
      console.error('[Return] Error creating reward:', rewardError);
    }
  }

  console.log('[Return] Session completed:', session.id, 'duration:', durationMinutes, 'min');
}
