// Message handler for processing raw WsCharge protocol messages
// This endpoint can be called by a TCP proxy to process station messages
// POST /api/stations/message

import { NextRequest, NextResponse } from 'next/server';
import { stationManager } from '@/lib/wscharge';
import * as protocol from '@/lib/wscharge/protocol';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stationId, messageHex, connectionId } = body as {
      stationId?: string;
      messageHex: string;
      connectionId?: string;
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
            responseData = {
              stationId: loginMsg.productSn,
              action: 'login',
              result: 'success',
            };
          }
          break;
        }

        case protocol.CommandCode.HEARTBEAT: {
          if (currentStationId) {
            responseBuffer = stationManager.handleHeartbeat(currentStationId);
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
              responseData = {
                stationId: currentStationId,
                action: 'borrow_response',
                slotNumber: borrowResponse.slotNumber,
                success: borrowResponse.result === protocol.BorrowResult.SUCCESS,
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
