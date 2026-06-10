// Individual station API route - get station details and send commands
import { NextRequest, NextResponse } from 'next/server';
import { stationManager } from '@/lib/wscharge';
import * as protocol from '@/lib/wscharge/protocol';
import { stationRepository, campaignRepository } from '@/lib/db';
import { nullIfEmptyUuid } from '@/lib/db/schema-compat';
import { resolveDbStationId } from '@/lib/db/station-resolve';
import { enforceRateLimit, requireAdminSession } from '@/lib/api/route-helpers';
import { validateBody, schemas } from '@/lib/security/validation';
import { auditAdminHardwareCommand } from '@/lib/admin/hardware-command-audit';

// GET /api/stations/[id] - Get station details (database and/or live hardware)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = await enforceRateLimit(request, 'api');
  if (rateLimited) return rateLimited;

  const { id: stationId } = await params;
  const source = request.nextUrl.searchParams.get('source') || 'both';

  try {
    if (source === 'database' || source === 'both') {
      const dbStationId = await resolveDbStationId(stationId);
      const dbStation = dbStationId ? await stationRepository.getById(dbStationId) : null;
      if (dbStation) {
        const memoryStation = stationManager.getStation(stationId) ||
          (dbStation.external_id ? stationManager.getStation(dbStation.external_id) : undefined);
        let campaign = null;
        const stationCampaignId = nullIfEmptyUuid(dbStation.campaign_id);
        if (stationCampaignId) {
          campaign = await campaignRepository.getById(stationCampaignId);
        }
        const availableSlots = dbStation.slots?.filter((s) => s.status === 'occupied').length ?? 0;
        return NextResponse.json({
          success: true,
          data: {
            id: dbStation.id,
            name: dbStation.name,
            location: dbStation.location,
            status: memoryStation?.isOnline ? 'online' : dbStation.status,
            isOnline: memoryStation?.isOnline ?? dbStation.status === 'online',
            totalSlots: dbStation.total_slots,
            availableSlots,
            campaignId: stationCampaignId ?? null,
            campaignName: campaign?.name ?? campaign?.event_name,
            hourlyRate: campaign ? Number(campaign.hourly_rate) : 2,
            dailyCap: campaign ? Number(campaign.daily_cap) : 10,
            depositAmount: campaign ? Number(campaign.deposit_amount) : 25,
            rewardThresholdMinutes: campaign?.reward_threshold_minutes ?? 60,
            rewardDescription: campaign?.reward_description ?? '',
            rewardValue: campaign ? Number(campaign.reward_value) : 0,
            lastHeartbeat: dbStation.last_heartbeat,
            connectedAt:
              memoryStation?.connectedAt?.toISOString() ??
              dbStation.connected_at ??
              dbStation.created_at,
            inventory: dbStation.slots?.map((slot) => ({
              slotNumber: slot.slot_number,
              status: slot.status,
              batteryLevel: slot.battery_level,
            })),
          },
        });
      }
    }

    const station = stationManager.getStation(stationId);
    if (!station) {
      return NextResponse.json(
        { success: false, error: 'Station not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: station.stationId,
        stationId: station.stationId,
        productSn: station.productSn,
        isOnline: station.isOnline,
        connectedAt: station.connectedAt.toISOString(),
        lastHeartbeat: station.lastHeartbeat.toISOString(),
        inventory: station.inventory.map(slot => ({
          slotNumber: slot.slotNumber,
          terminalId: protocol.formatTerminalId(slot.terminalId),
          batteryLevel: protocol.batteryLevelToPercent(slot.batteryLevel),
        })),
      },
    });
  } catch (error) {
    console.error('[API] Error fetching station:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch station data' },
      { status: 500 }
    );
  }
}

// POST /api/stations/[id] - Send command to station (admin/operator only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminGate = await requireAdminSession(request);
  if (!adminGate.ok) {
    return adminGate.response;
  }

  const { id: stationId } = await params;

  try {
    const validated = await validateBody(request, schemas.adminStationCommand);
    if (!validated.success) return validated.error;

    const { command, slotNumber } = validated.data;

    let result: {
      success: boolean;
      data?: unknown;
      error?: string;
      commandBuffer: Buffer;
      proxyOnly?: boolean;
    };
    let payload: Buffer | undefined;

    switch (command) {
      case 'query_inventory':
        result = await stationManager.sendCommand(
          stationId, 
          protocol.CommandCode.QUERY_INVENTORY
        );
        break;

      case 'borrow':
        if (typeof slotNumber !== 'number') {
          return NextResponse.json(
            { success: false, error: 'Slot number is required for borrow command' },
            { status: 400 }
          );
        }
        payload = Buffer.alloc(1);
        payload.writeUInt8(slotNumber, 0);
        result = await stationManager.sendCommand(
          stationId, 
          protocol.CommandCode.BORROW_POWERBANK,
          payload
        );
        break;

      case 'force_eject':
        if (typeof slotNumber !== 'number') {
          return NextResponse.json(
            { success: false, error: 'Slot number is required for force_eject command' },
            { status: 400 }
          );
        }
        payload = Buffer.alloc(1);
        payload.writeUInt8(slotNumber, 0);
        result = await stationManager.sendCommand(
          stationId, 
          protocol.CommandCode.FORCE_EJECT,
          payload
        );
        break;

      case 'full_eject': {
        const fullEject = await stationManager.sendFullEject(stationId);
        result = {
          success: fullEject.success,
          error: fullEject.error,
          commandBuffer: fullEject.commandBuffer,
          proxyOnly: fullEject.proxyOnly,
          data: fullEject.variants ? { variants: fullEject.variants } : undefined,
        };
        break;
      }

      case 'reboot':
        result = await stationManager.sendCommand(
          stationId, 
          protocol.CommandCode.REMOTE_REBOOT
        );
        break;

      case 'query_info':
        result = await stationManager.sendCommand(
          stationId, 
          protocol.CommandCode.QUERY_NETWORK_INFO
        );
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown command' },
          { status: 400 }
        );
    }

    if (!result.success) {
      await auditAdminHardwareCommand({
        actorUserId: adminGate.auth.userId,
        stationIdOrExternal: stationId,
        command,
        slotNumber,
        success: false,
        error: result.error,
      });
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    await auditAdminHardwareCommand({
      actorUserId: adminGate.auth.userId,
      stationIdOrExternal: stationId,
      command,
      slotNumber,
      success: true,
    });

    // Proxy path: inventory response is async via /api/stations/message → DB
    if (command === 'query_inventory' && result.proxyOnly) {
      await new Promise((r) => setTimeout(r, 3000));
      const refreshedId = await resolveDbStationId(stationId);
      const dbStation = refreshedId ? await stationRepository.getById(refreshedId) : null;
      const occupied =
        dbStation?.slots?.filter((s) => s.status === 'occupied') ?? [];
      return NextResponse.json({
        success: true,
        data: {
          proxyOnly: true,
          slotCount: occupied.length,
          slots: occupied.map((s) => ({
            slotNumber: s.slot_number,
            batteryLevel: s.battery_level,
            status: s.status,
          })),
        },
        command,
        stationId,
      });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      command,
      stationId,
    });
  } catch (error) {
    console.error('[API] Error sending command:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send command' },
      { status: 500 }
    );
  }
}
