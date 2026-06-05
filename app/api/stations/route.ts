// Station management API routes - handles hardware commands via HTTP
// Combines in-memory station manager with database persistence

import { NextRequest, NextResponse } from 'next/server';
import { stationManager } from '@/lib/wscharge';
import * as protocol from '@/lib/wscharge/protocol';
import { stationRepository } from '@/lib/db';
import { withPublicApi } from '@/lib/api/public-route';

export const GET = withPublicApi(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source') || 'both'; // 'memory', 'database', 'both'
    const status = searchParams.get('status');
    const campaignId = searchParams.get('campaignId');
    const search = searchParams.get('search');

    // Get stations from in-memory manager (real-time connection state)
    const memoryStations = stationManager.getConnectedStations();
    
    // Get stations from database (persistent data)
    let dbStations: Awaited<ReturnType<typeof stationRepository.getAll>> = [];
    
    if (source === 'database' || source === 'both') {
      try {
        dbStations = await stationRepository.getAll({
          status: status ? [status as 'online' | 'offline' | 'maintenance' | 'low_battery' | 'error'] : undefined,
          campaignId: campaignId || undefined,
          search: search || undefined,
          isEnabled: true,
        });
      } catch (dbError) {
        console.error('[API] Database error:', dbError);
        // Continue with memory-only if DB fails
      }
    }

    // Merge data: prefer database for persistent fields, memory for real-time state
    const mergedStations = dbStations.map(dbStation => {
      const memoryStation = memoryStations.find(
        m => m.productSn === dbStation.external_id || m.stationId === dbStation.id
      );

      return {
        // Database fields
        id: dbStation.id,
        stationId: dbStation.id,
        productSn: dbStation.external_id,
        externalId: dbStation.external_id,
        name: dbStation.name,
        location: dbStation.location,
        latitude: dbStation.latitude,
        longitude: dbStation.longitude,
        totalSlots: dbStation.total_slots,
        campaignId: dbStation.campaign_id,
        firmwareVersion: dbStation.firmware_version,
        hardwareVersion: dbStation.hardware_version,
        isEnabled: dbStation.is_enabled,
        createdAt: dbStation.created_at,
        
        // Real-time state (prefer memory, fall back to database)
        status: memoryStation?.isOnline ? 'online' : dbStation.status,
        isOnline: memoryStation?.isOnline ?? dbStation.status === 'online',
        lastHeartbeat: memoryStation?.lastHeartbeat?.toISOString() || dbStation.last_heartbeat,
        signalStrength: memoryStation?.signalStrength ?? dbStation.signal_strength,
        temperature: dbStation.temperature,
        
        // Inventory
        slots: dbStation.slots.map(slot => {
          const memorySlot = memoryStation?.inventory.find(i => i.slotNumber === slot.slot_number);
          return {
            slotNumber: slot.slot_number,
            status: slot.status,
            powerBankId: memorySlot?.terminalId 
              ? protocol.formatTerminalId(memorySlot.terminalId)
              : slot.power_bank_id,
            batteryLevel: memorySlot 
              ? protocol.batteryLevelToPercent(memorySlot.batteryLevel)
              : slot.battery_level,
            isCharging: slot.is_charging,
            errorCode: slot.error_code,
          };
        }),
        inventory: dbStation.slots
          .filter((slot) => slot.status === 'occupied' && slot.power_bank_id)
          .map((slot) => {
            const memorySlot = memoryStation?.inventory.find(i => i.slotNumber === slot.slot_number);
            return {
              slotNumber: slot.slot_number,
              terminalId: memorySlot?.terminalId ?? slot.power_bank_id ?? '',
              batteryLevel: memorySlot
                ? protocol.batteryLevelToPercent(memorySlot.batteryLevel)
                : slot.battery_level ?? 0,
            };
          }),
        availableSlots: dbStation.available_slots,
        occupiedSlots: dbStation.occupied_slots,
        
        // Connection info
        connectionIp: dbStation.connection_ip,
        connectedAt:
          memoryStation?.connectedAt?.toISOString() ??
          dbStation.connected_at ??
          dbStation.created_at,
      };
    });

    // Add any memory-only stations (not yet in database)
    if (source === 'memory' || source === 'both') {
      for (const memStation of memoryStations) {
        const exists = mergedStations.some(
          m => m.externalId === memStation.productSn
        );
        
        if (!exists) {
          mergedStations.push({
            id: memStation.stationId,
            stationId: memStation.stationId,
            productSn: memStation.productSn,
            externalId: memStation.productSn,
            name: `Station ${memStation.productSn.slice(-6)}`,
            location: null,
            latitude: null,
            longitude: null,
            totalSlots: memStation.inventory.length || 12,
            campaignId: null,
            firmwareVersion: memStation.firmwareVersion,
            hardwareVersion: null,
            isEnabled: true,
            createdAt: memStation.connectedAt.toISOString(),
            
            status: 'online',
            isOnline: memStation.isOnline,
            lastHeartbeat: memStation.lastHeartbeat.toISOString(),
            signalStrength: memStation.signalStrength,
            temperature: null,
            
            slots: memStation.inventory.map(slot => ({
              slotNumber: slot.slotNumber,
              status: 'occupied',
              powerBankId: protocol.formatTerminalId(slot.terminalId),
              batteryLevel: protocol.batteryLevelToPercent(slot.batteryLevel),
              isCharging: false,
              errorCode: null,
            })),
            inventory: memStation.inventory.map((slot) => ({
              slotNumber: slot.slotNumber,
              terminalId: slot.terminalId,
              batteryLevel: protocol.batteryLevelToPercent(slot.batteryLevel),
            })),
            availableSlots: memStation.inventory.length,
            occupiedSlots: 0,
            
            connectionIp: null,
            connectedAt: memStation.connectedAt.toISOString(),
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: mergedStations,
      meta: {
        total: mergedStations.length,
        online: mergedStations.filter(s => s.isOnline).length,
        memoryConnections: memoryStations.length,
        databaseRecords: dbStations.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error fetching stations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch station data' },
      { status: 500 }
    );
  }
});
