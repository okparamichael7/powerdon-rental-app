// Station Repository - Database operations for stations and hardware
import { createServiceClient } from '@/lib/supabase/admin';
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
    return ((data || []) as StationRow[]).map((station): StationWithSlots => ({
      ...station,
      slots: station.slots || [],
      available_slots: (station.slots || []).filter((s) => s.status === 'occupied').length,
      occupied_slots: (station.slots || []).filter((s) => s.status === 'empty' || s.status === 'reserved').length,
    }));
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
    
    const { data, error } = await supabase
      .from('stations')
      .insert(station)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, updates: Database['public']['Tables']['stations']['Update']): Promise<DbStation> {
    const supabase = await createServiceClient();
    
    const { data, error } = await supabase
      .from('stations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
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
    
    if (existing) {
      // Update existing station
      return this.updateByExternalId(externalId, {
        status: 'online',
        last_heartbeat: new Date().toISOString(),
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
        last_heartbeat: new Date().toISOString(),
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
    
    // Update each slot
    for (const slot of inventory) {
      await this.updateSlot(stationId, slot.slotNumber, {
        status: slot.status,
        battery_level: slot.batteryLevel,
        power_bank_id: slot.powerBankId,
        is_charging: slot.isCharging,
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
    
    const { data, error } = await supabase
      .from('station_slots')
      .update({ status: 'reserved', last_status_change: new Date().toISOString() })
      .eq('station_id', stationId)
      .eq('slot_number', slotNumber)
      .eq('status', 'occupied') // Only reserve if currently occupied
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return false;
      throw error;
    }

    return !!data;
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
