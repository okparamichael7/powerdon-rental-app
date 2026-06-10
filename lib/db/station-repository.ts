// Station Repository - Database operations for stations and hardware
import { createServiceClient } from '@/lib/supabase/admin';
import { powerBankRepository } from './power-bank-repository';
import {
  countWithSessionStatusFallback,
  isInvalidUuidInputError,
  isSchemaGapError,
  mutateWithSchemaFallback,
} from './schema-compat';
import { slotRemovalBlockers } from '@/lib/admin/slot-safety';
import type { Database, DbStation, DbStationSlot, DbHardwareCommand, DbHardwareEvent, Json, StationStatus, SlotStatus, CommandStatus, CommandType } from './types';

export interface StationWithSlots extends DbStation {
  slots: DbStationSlot[];
  available_slots: number;
  occupied_slots: number;
}

export interface StationFilters {
  status?: StationStatus[];
  campaignId?: string;
  isEnabled?: boolean;
  includeArchived?: boolean;
  hardwareType?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CommandFilters {
  stationId?: string;
  status?: CommandStatus[];
  commandType?: CommandType[];
  limit?: number;
  offset?: number;
}

class StationRepository {
  // ============================================================================
  // STATIONS
  // ============================================================================

  async getAll(filters?: StationFilters): Promise<StationWithSlots[]> {
    const supabase = await createServiceClient();
    
    let query = supabase
      .from('stations')
      .select(`
        *,
        slots:station_slots(*)
      `)
      .order('name');

    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    if (filters?.campaignId) {
      query = query.eq('campaign_id', filters.campaignId);
    }

    if (filters?.isEnabled !== undefined) {
      query = query.eq('is_enabled', filters.isEnabled);
    }

    if (filters?.hardwareType) {
      query = query.eq('hardware_type', filters.hardwareType);
    }

    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,location.ilike.%${filters.search}%,external_id.ilike.%${filters.search}%`);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;

    type StationRow = DbStation & { slots?: DbStationSlot[] | null };
    let rows = ((data || []) as StationRow[]).map((station): StationWithSlots => ({
      ...station,
      slots: station.slots || [],
      available_slots: (station.slots || []).filter((s) => s.status === 'occupied').length,
      occupied_slots: (station.slots || []).filter((s) => s.status === 'empty' || s.status === 'reserved').length,
    }));

    if (filters?.includeArchived !== true) {
      rows = rows.filter((s) => !s.archived_at)
    }

    return rows;
  }

  async getById(id: string): Promise<StationWithSlots | null> {
    const supabase = await createServiceClient();
    
    const { data, error } = await supabase
      .from('stations')
      .select(`
        *,
        slots:station_slots(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      if (isInvalidUuidInputError(error)) return null;
      throw error;
    }

    return {
      ...data,
      slots: data.slots || [],
      available_slots: (data.slots || []).filter((s: DbStationSlot) => s.status === 'occupied').length,
      occupied_slots: (data.slots || []).filter((s: DbStationSlot) => s.status === 'empty' || s.status === 'reserved').length,
    };
  }

  async getByExternalId(externalId: string): Promise<StationWithSlots | null> {
    const supabase = await createServiceClient();
    
    const { data, error } = await supabase
      .from('stations')
      .select(`
        *,
        slots:station_slots(*)
      `)
      .eq('external_id', externalId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      ...data,
      slots: data.slots || [],
      available_slots: (data.slots || []).filter((s: DbStationSlot) => s.status === 'occupied').length,
      occupied_slots: (data.slots || []).filter((s: DbStationSlot) => s.status === 'empty' || s.status === 'reserved').length,
    };
  }

  async create(station: Database['public']['Tables']['stations']['Insert']): Promise<DbStation> {
    const supabase = await createServiceClient();

    return mutateWithSchemaFallback(
      station as Record<string, unknown>,
      async (payload) => {
        const { data, error } = await supabase
          .from('stations')
          .insert(payload)
          .select()
          .single();
        return { data, error };
      },
    );
  }

  async update(id: string, updates: Database['public']['Tables']['stations']['Update']): Promise<DbStation> {
    const supabase = await createServiceClient();

    return mutateWithSchemaFallback(
      updates as Record<string, unknown>,
      async (payload) => {
        const { data, error } = await supabase
          .from('stations')
          .update(payload)
          .eq('id', id)
          .select()
          .single();
        return { data, error };
      },
    );
  }

  async updateByExternalId(externalId: string, updates: Database['public']['Tables']['stations']['Update']): Promise<DbStation> {
    const supabase = await createServiceClient();
    
    const { data, error } = await supabase
      .from('stations')
      .update(updates)
      .eq('external_id', externalId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateStatus(id: string, status: StationStatus): Promise<void> {
    const supabase = await createServiceClient();
    
    const { error } = await supabase
      .from('stations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

  async updateHeartbeat(id: string, data: {
    signalStrength?: number;
    temperature?: number;
    connectionIp?: string;
  }): Promise<void> {
    const supabase = await createServiceClient();
    
    const { error } = await supabase
      .from('stations')
      .update({
        status: 'online',
        last_heartbeat: new Date().toISOString(),
        signal_strength: data.signalStrength,
        temperature: data.temperature,
        connection_ip: data.connectionIp,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const supabase = await createServiceClient();
    
    const { error } = await supabase
      .from('stations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async createWithSlots(
    station: Database['public']['Tables']['stations']['Insert'],
    slotCount: number,
  ): Promise<DbStation> {
    const created = await this.create(station);
    const slots = Array.from({ length: slotCount }, (_, i) => ({
      station_id: created.id,
      slot_number: i + 1,
      status: 'empty' as SlotStatus,
      is_charging: false,
      metadata: {},
    }));

    const supabase = await createServiceClient();
    const { error: slotsError } = await supabase.from('station_slots').insert(slots);
    if (slotsError) {
      await this.delete(created.id);
      throw slotsError;
    }
    return created;
  }

  async archive(id: string, updatedBy: string): Promise<DbStation> {
    return this.update(id, {
      archived_at: new Date().toISOString(),
      is_enabled: false,
      status: 'offline',
      updated_by: updatedBy,
    });
  }

  async restore(id: string, updatedBy: string): Promise<DbStation> {
    return this.update(id, {
      archived_at: null,
      is_enabled: true,
      updated_by: updatedBy,
    });
  }

  async addSlots(stationId: string, fromSlot: number, toSlot: number): Promise<number> {
    const supabase = await createServiceClient();
    const newSlots = Array.from({ length: toSlot - fromSlot }, (_, i) => ({
      station_id: stationId,
      slot_number: fromSlot + i + 1,
      status: 'empty' as SlotStatus,
      is_charging: false,
      metadata: {},
    }));
    if (newSlots.length === 0) return 0;

    const { error } = await supabase.from('station_slots').insert(newSlots);
    if (error) throw error;
    return newSlots.length;
  }

  async removeSlotsAbove(stationId: string, maxSlotNumber: number): Promise<number> {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from('station_slots')
      .delete()
      .eq('station_id', stationId)
      .gt('slot_number', maxSlotNumber)
      .select('id');

    if (error) throw error;
    return data?.length ?? 0;
  }

  async getSlotReductionBlockers(stationId: string, newMaxSlot: number): Promise<string[]> {
    const slots = await this.getSlots(stationId);
    const toRemove = slots.filter((s) => s.slot_number > newMaxSlot);
    const blockers: string[] = [];

    for (const slot of toRemove) {
      const activeOnSlot = await this.countActiveRentalsForSlot(stationId, slot.slot_number);
      const historical = await this.countHistoricalRentalsForSlot(stationId, slot.slot_number);
      blockers.push(
        ...slotRemovalBlockers({
          slot,
          activeRentals: activeOnSlot,
          historicalRentals: historical,
        }),
      );
    }

    return blockers;
  }

  async countActiveRentals(stationId: string): Promise<number> {
    const supabase = await createServiceClient();
    const { count, error } = await supabase
      .from('rental_sessions')
      .select('id', { count: 'exact', head: true })
      .or(`pickup_station_id.eq.${stationId},return_station_id.eq.${stationId}`)
      .in('status', ['pending', 'active']);

    if (error) throw error;
    return count ?? 0;
  }

  async countActiveRentalsForSlot(stationId: string, slotNumber: number): Promise<number> {
    const supabase = await createServiceClient();
    const { count, error } = await supabase
      .from('rental_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('pickup_station_id', stationId)
      .eq('pickup_slot_number', slotNumber)
      .in('status', ['pending', 'active']);

    if (error) throw error;
    return count ?? 0;
  }

  async countHistoricalRentals(stationId: string): Promise<number> {
    const supabase = await createServiceClient();
    return countWithSessionStatusFallback(
      ['completed', 'cancelled', 'expired', 'failed'],
      async (statuses) =>
        supabase
          .from('rental_sessions')
          .select('id', { count: 'exact', head: true })
          .or(`pickup_station_id.eq.${stationId},return_station_id.eq.${stationId}`)
          .in('status', statuses),
    );
  }

  async countHistoricalRentalsForSlot(stationId: string, slotNumber: number): Promise<number> {
    const supabase = await createServiceClient();
    const { count, error } = await supabase
      .from('rental_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('pickup_station_id', stationId)
      .eq('pickup_slot_number', slotNumber);

    if (error) throw error;
    return count ?? 0;
  }

  async listMaintenanceRecords(stationId: string, limit = 20) {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from('station_maintenance_records')
      .select('*')
      .eq('station_id', stationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (error.code === '42P01' || isSchemaGapError(error)) return [];
      throw error;
    }
    return data ?? [];
  }

  async createMaintenanceRecord(input: {
    stationId: string;
    slotNumber?: number;
    title: string;
    description?: string;
    reportedBy: string;
  }) {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from('station_maintenance_records')
      .insert({
        station_id: input.stationId,
        slot_number: input.slotNumber ?? null,
        title: input.title,
        description: input.description ?? null,
        reported_by: input.reportedBy,
        status: 'open',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Register a new station from hardware login
  async registerFromHardware(externalId: string, data: {
    iccid?: string;
    firmwareVersion?: string;
    hardwareVersion?: string;
    connectionIp?: string;
    connectionPort?: number;
    totalSlots?: number;
  }): Promise<DbStation> {
    const supabase = await createServiceClient();
    
    // Check if station already exists
    const existing = await this.getByExternalId(externalId);
    
    const now = new Date().toISOString();

    if (existing) {
      // Update existing station
      return this.updateByExternalId(externalId, {
        status: 'online',
        connected_at: now,
        last_heartbeat: now,
        iccid: data.iccid || existing.iccid,
        firmware_version: data.firmwareVersion || existing.firmware_version,
        hardware_version: data.hardwareVersion || existing.hardware_version,
        connection_ip: data.connectionIp || existing.connection_ip,
        connection_port: data.connectionPort || existing.connection_port,
      });
    }

    // Create new station (device_id: legacy v0 NOT NULL column on partial DBs — same as ProductSn)
    const { data: newStation, error } = await supabase
      .from('stations')
      .insert({
        external_id: externalId,
        device_id: externalId,
        name: `Station ${externalId.slice(-6)}`,
        status: 'online',
        total_slots: data.totalSlots || 12,
        iccid: data.iccid,
        firmware_version: data.firmwareVersion,
        hardware_version: data.hardwareVersion,
        connection_ip: data.connectionIp,
        connection_port: data.connectionPort,
        connected_at: now,
        last_heartbeat: now,
        is_enabled: true,
        settings: {},
        metadata: {},
      })
      .select()
      .single();

    if (error) throw error;

    // Create slots for the new station
    const slots = Array.from({ length: data.totalSlots || 12 }, (_, i) => ({
      station_id: newStation.id,
      slot_number: i + 1,
      status: 'empty' as SlotStatus,
      is_charging: false,
      metadata: {},
    }));

    const { error: slotsError } = await supabase
      .from('station_slots')
      .insert(slots);

    if (slotsError) throw slotsError;

    return newStation;
  }

  // ============================================================================
  // SLOTS
  // ============================================================================

  async getSlots(stationId: string): Promise<DbStationSlot[]> {
    const supabase = await createServiceClient();
    
    const { data, error } = await supabase
      .from('station_slots')
      .select('*')
      .eq('station_id', stationId)
      .order('slot_number');

    if (error) throw error;
    return data || [];
  }

  async getSlot(stationId: string, slotNumber: number): Promise<DbStationSlot | null> {
    const supabase = await createServiceClient();
    
    const { data, error } = await supabase
      .from('station_slots')
      .select('*')
      .eq('station_id', stationId)
      .eq('slot_number', slotNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async updateSlot(stationId: string, slotNumber: number, updates: Database['public']['Tables']['station_slots']['Update']): Promise<DbStationSlot> {
    const supabase = await createServiceClient();
    
    const { data, error } = await supabase
      .from('station_slots')
      .update({
        ...updates,
        last_status_change: updates.status ? new Date().toISOString() : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('station_id', stationId)
      .eq('slot_number', slotNumber)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateInventory(stationId: string, inventory: Array<{
    slotNumber: number;
    status: SlotStatus;
    batteryLevel?: number;
    powerBankId?: string;
    isCharging?: boolean;
  }>): Promise<void> {
    const supabase = await createServiceClient();

    const occupiedInReport = new Set(
      inventory
        .filter((slot) => slot.status === 'occupied')
        .map((slot) => slot.slotNumber),
    );

    const { data: existingSlots } = await supabase
      .from('station_slots')
      .select('slot_number, status')
      .eq('station_id', stationId);

    for (const row of existingSlots ?? []) {
      if (row.status === 'reserved') continue;
      if (!occupiedInReport.has(row.slot_number)) {
        await this.updateSlot(stationId, row.slot_number, {
          status: 'empty',
          power_bank_id: null,
          battery_level: 0,
        });
      }
    }

    for (const slot of inventory) {
      let powerBankDbId: string | null = null
      if (slot.status === 'occupied' && slot.powerBankId) {
        try {
          powerBankDbId = await powerBankRepository.resolveDbPowerBankId(
            slot.powerBankId,
            {
              stationId,
              slotNumber: slot.slotNumber,
              batteryLevel: slot.batteryLevel,
            },
          )
        } catch (err) {
          console.error('[DB] Power bank upsert failed during inventory sync', {
            stationId,
            slotNumber: slot.slotNumber,
            terminalId: slot.powerBankId,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      await this.updateSlot(stationId, slot.slotNumber, {
        status: slot.status,
        battery_level: slot.batteryLevel,
        power_bank_id: powerBankDbId,
        is_charging: slot.isCharging,
        metadata: slot.powerBankId
          ? { terminal_external_id: slot.powerBankId }
          : undefined,
      });
    }

    // Update station's last inventory sync
    await supabase
      .from('stations')
      .update({ last_inventory_sync: new Date().toISOString() })
      .eq('id', stationId);
  }

  async getAvailableSlot(stationId: string): Promise<DbStationSlot | null> {
    const supabase = await createServiceClient();
    
    const { data, error } = await supabase
      .from('station_slots')
      .select('*')
      .eq('station_id', stationId)
      .eq('status', 'occupied') // 'occupied' means has a power bank available
      .order('battery_level', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async reserveSlot(stationId: string, slotNumber: number): Promise<boolean> {
    const supabase = await createServiceClient();

    const updates: Record<string, unknown>[] = [
      { status: 'reserved', last_status_change: new Date().toISOString() },
      { status: 'reserved' },
    ];

    let lastError: { code?: string; message?: string } | null = null;
    for (const patch of updates) {
      const { data, error } = await supabase
        .from('station_slots')
        .update(patch)
        .eq('station_id', stationId)
        .eq('slot_number', slotNumber)
        .eq('status', 'occupied')
        .select()
        .single();

      if (!error) return !!data;
      if (error.code === 'PGRST116') return false;
      if (!isSchemaGapError(error)) throw error;
      lastError = error;
    }

    if (lastError) throw lastError;
    return false;
  }

  /** Release slots stuck in reserved (e.g. abandoned checkouts). Mirrors migration 016. */
  async releaseStuckReservedSlots(maxAgeMinutes = 30): Promise<number> {
    const supabase = await createServiceClient();
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();

    const patches: Record<string, unknown>[] = [
      { status: 'occupied', last_status_change: new Date().toISOString() },
      { status: 'occupied' },
    ];

    let lastError: { code?: string; message?: string } | null = null;
    for (const patch of patches) {
      for (const useTimeFilter of [true, false]) {
        let query = supabase
          .from('station_slots')
          .update(patch)
          .eq('status', 'reserved')
          .select('id');

        if (useTimeFilter) {
          query = query.lt('last_status_change', cutoff);
        }

        const { data, error } = await query;
        if (!error) return data?.length ?? 0;
        if (!isSchemaGapError(error)) throw error;
        lastError = error;
      }
    }

    if (lastError) throw lastError;
    return 0;
  }

  async releaseSlot(stationId: string, slotNumber: number): Promise<void> {
    const supabase = await createServiceClient();
    
    const { error } = await supabase
      .from('station_slots')
      .update({ 
        status: 'empty', 
        power_bank_id: null,
        battery_level: null,
        last_status_change: new Date().toISOString() 
      })
      .eq('station_id', stationId)
      .eq('slot_number', slotNumber);

    if (error) throw error;
  }

  // ============================================================================
  // HARDWARE COMMANDS
  // ============================================================================

  async createCommand(command: Partial<Database['public']['Tables']['hardware_commands']['Insert']> & {
    station_id: string;
    command_type: CommandType;
  }): Promise<DbHardwareCommand> {
    const supabase = await createServiceClient();
    
    const { data, error } = await supabase
      .from('hardware_commands')
      .insert(command)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getCommand(id: string): Promise<DbHardwareCommand | null> {
    const supabase = await createServiceClient();
    
    const { data, error } = await supabase
      .from('hardware_commands')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async getPendingCommands(stationId: string, limit = 10): Promise<DbHardwareCommand[]> {
    const supabase = await createServiceClient();
    
    const { data, error } = await supabase
      .from('hardware_commands')
      .select('*')
      .eq('station_id', stationId)
      .in('status', ['pending', 'sent'])
      .lt('expires_at', new Date().toISOString())
      .order('priority')
      .order('created_at')
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async updateCommand(id: string, updates: Database['public']['Tables']['hardware_commands']['Update']): Promise<DbHardwareCommand> {
    const supabase = await createServiceClient();
    
    const { data, error } = await supabase
      .from('hardware_commands')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async markCommandSent(id: string): Promise<void> {
    await this.updateCommand(id, {
      status: 'sent',
      sent_at: new Date().toISOString(),
    });
  }

  async markCommandCompleted(id: string, response: { code?: number; data?: Record<string, unknown> }): Promise<void> {
    await this.updateCommand(id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      response_code: response.code,
      response_data: (response.data || {}) as Json,
    });
  }

  async markCommandFailed(id: string, errorMessage: string): Promise<void> {
    const command = await this.getCommand(id);
    if (!command) return;

    const newRetryCount = command.retry_count + 1;
    const shouldRetry = newRetryCount < command.max_retries;

    await this.updateCommand(id, {
      status: shouldRetry ? 'pending' : 'failed',
      error_message: errorMessage,
      retry_count: newRetryCount,
    });
  }

  // ============================================================================
  // HARDWARE EVENTS
  // ============================================================================

  async logHardwareEvent(event: Partial<Database['public']['Tables']['hardware_events']['Insert']> & {
    event_type: string;
    direction: 'inbound' | 'outbound';
  }): Promise<DbHardwareEvent> {
    const supabase = await createServiceClient();
    
    const { data, error } = await supabase
      .from('hardware_events')
      .insert(event)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async logHardwareEventIdempotent(
    event: Partial<Database['public']['Tables']['hardware_events']['Insert']> & {
      event_type: string;
      direction: 'inbound' | 'outbound';
      idempotency_key: string;
    }
  ): Promise<DbHardwareEvent | null> {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from('hardware_events')
      .insert(event)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return null;
      throw error;
    }
    return data;
  }

  async getHardwareEvents(stationId: string, limit = 100): Promise<DbHardwareEvent[]> {
    const supabase = await createServiceClient();
    
    const { data, error } = await supabase
      .from('hardware_events')
      .select('*')
      .eq('station_id', stationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  // ============================================================================
  // OFFLINE DETECTION
  // ============================================================================

  async markOfflineStations(timeoutMinutes = 3): Promise<number> {
    const supabase = await createServiceClient();
    
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('stations')
      .update({ status: 'offline' })
      .eq('status', 'online')
      .lt('last_heartbeat', cutoff)
      .select('id');

    if (error) throw error;
    return (data || []).length;
  }
}

export const stationRepository = new StationRepository();
