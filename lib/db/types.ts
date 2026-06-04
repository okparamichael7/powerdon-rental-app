// Database types generated from schema
// These types match the Supabase database schema

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type SessionStatus = 'pending' | 'active' | 'completed' | 'expired' | 'failed' | 'cancelled';
export type StationStatus = 'online' | 'offline' | 'maintenance' | 'low_battery' | 'error';
export type SlotStatus = 'empty' | 'occupied' | 'reserved' | 'error' | 'disabled';
export type RewardStatus = 'pending' | 'qualified' | 'issued' | 'redeemed' | 'expired' | 'cancelled';
export type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'refunded' | 'failed' | 'cancelled';
export type PowerBankStatus = 'available' | 'rented' | 'charging' | 'maintenance' | 'lost' | 'damaged';
export type CommandType = 'login' | 'heartbeat' | 'inventory' | 'borrow' | 'return' | 'force_eject' | 'reboot' | 'settings' | 'update';
export type CommandStatus = 'pending' | 'sent' | 'acknowledged' | 'completed' | 'failed' | 'timeout';
export type EventType = 'scan' | 'auth' | 'payment' | 'unlock' | 'pickup' | 'return' | 'reward' | 'refund' | 'error' | 'support' | 'admin';
export type SupportCategory = 'rental_issue' | 'payment_issue' | 'return_issue' | 'reward_issue' | 'station_issue' | 'account_issue' | 'other';
export type SupportPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SupportStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';

// Database row types
export interface DbCampaign {
  id: string;
  name: string;
  event_name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  hourly_rate: number;
  daily_cap: number;
  deposit_amount: number;
  reward_threshold_minutes: number;
  reward_type: string;
  reward_value: number;
  reward_description: string | null;
  is_active: boolean;
  settings: Json;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface DbStation {
  id: string;
  external_id: string | null;
  iccid: string | null;
  name: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  status: StationStatus;
  total_slots: number;
  firmware_version: string | null;
  hardware_version: string | null;
  signal_strength: number | null;
  temperature: number | null;
  last_heartbeat: string | null;
  last_inventory_sync: string | null;
  connection_ip: string | null;
  connection_port: number | null;
  campaign_id: string | null;
  settings: Json;
  metadata: Json;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbStationSlot {
  id: string;
  station_id: string;
  slot_number: number;
  status: SlotStatus;
  power_bank_id: string | null;
  battery_level: number | null;
  is_charging: boolean;
  last_status_change: string;
  error_code: string | null;
  error_message: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface DbPowerBank {
  id: string;
  external_id: string;
  model: string | null;
  capacity_mah: number;
  status: PowerBankStatus;
  current_station_id: string | null;
  current_slot_number: number | null;
  battery_level: number | null;
  charge_cycles: number;
  total_rental_minutes: number;
  total_rentals: number;
  last_maintenance: string | null;
  manufactured_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface DbUser {
  id: string;
  auth_user_id: string | null;
  email: string;
  email_verified: boolean;
  name: string | null;
  phone: string | null;
  phone_verified: boolean;
  stripe_customer_id: string | null;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  total_rentals: number;
  total_spent: number;
  total_rewards_earned: number;
  last_rental_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface DbRentalSession {
  id: string;
  session_code: string;
  user_id: string;
  campaign_id: string | null;
  pickup_station_id: string;
  pickup_slot_number: number;
  power_bank_id: string | null;
  return_station_id: string | null;
  return_slot_number: number | null;
  status: SessionStatus;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  deposit_amount: number;
  hourly_rate: number;
  daily_cap: number;
  amount_charged: number;
  amount_refunded: number;
  payment_status: PaymentStatus;
  payment_method: string | null;
  payment_intent_id: string | null;
  payment_authorization_id: string | null;
  reward_threshold_minutes: number | null;
  reward_qualified: boolean;
  reward_status: RewardStatus;
  reward_id: string | null;
  unlock_token: string | null;
  unlock_token_expires_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface DbSessionEvent {
  id: string;
  session_id: string;
  event_type: EventType;
  description: string;
  metadata: Json;
  actor_type: string;
  actor_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface DbReward {
  id: string;
  code: string;
  session_id: string;
  user_id: string;
  campaign_id: string;
  reward_type: string;
  value: number;
  description: string | null;
  status: RewardStatus;
  issued_at: string;
  expires_at: string;
  redeemed_at: string | null;
  redemption_location: string | null;
  redeemed_by_staff_id: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface DbHardwareCommand {
  id: string;
  station_id: string;
  command_type: CommandType;
  slot_number: number | null;
  payload: Json;
  status: CommandStatus;
  priority: number;
  created_at: string;
  sent_at: string | null;
  acknowledged_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  response_code: number | null;
  response_data: Json | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  session_id: string | null;
  triggered_by: string | null;
  metadata: Json;
}

export interface DbHardwareEvent {
  id: string;
  station_id: string | null;
  station_external_id: string | null;
  event_type: string;
  direction: 'inbound' | 'outbound';
  raw_data: string | null; // Base64 encoded
  parsed_data: Json | null;
  command_id: string | null;
  response_code: number | null;
  processing_time_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export interface DbSupportTicket {
  id: string;
  ticket_number: string;
  user_id: string | null;
  session_id: string | null;
  category: SupportCategory;
  priority: SupportPriority;
  status: SupportStatus;
  subject: string;
  description: string;
  assigned_to: string | null;
  resolved_at: string | null;
  resolution: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface DbAnalyticsDaily {
  id: string;
  date: string;
  campaign_id: string | null;
  station_id: string | null;
  total_sessions: number;
  completed_sessions: number;
  failed_sessions: number;
  cancelled_sessions: number;
  total_duration_minutes: number;
  avg_duration_minutes: number;
  total_revenue: number;
  total_deposits: number;
  total_refunds: number;
  rewards_qualified: number;
  rewards_issued: number;
  rewards_redeemed: number;
  rewards_value_issued: number;
  rewards_value_redeemed: number;
  unique_users: number;
  new_users: number;
  returning_users: number;
  computed_at: string;
}

export interface DbSystemSetting {
  key: string;
  value: Json;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

// Database schema type for Supabase client
export interface Database {
  public: {
    Tables: {
      campaigns: {
        Row: DbCampaign;
        Insert: Omit<DbCampaign, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<DbCampaign, 'id' | 'created_at'>>;
        Relationships: [];
      };
      stations: {
        Row: DbStation;
        Insert: Omit<DbStation, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<DbStation, 'id' | 'created_at'>>;
        Relationships: [];
      };
      station_slots: {
        Row: DbStationSlot;
        Insert: Omit<DbStationSlot, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<DbStationSlot, 'id' | 'created_at'>>;
        Relationships: [];
      };
      power_banks: {
        Row: DbPowerBank;
        Insert: Omit<DbPowerBank, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<DbPowerBank, 'id' | 'created_at'>>;
        Relationships: [];
      };
      users: {
        Row: DbUser;
        Insert: Omit<DbUser, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<DbUser, 'id' | 'created_at'>>;
        Relationships: [];
      };
      rental_sessions: {
        Row: DbRentalSession;
        Insert: Omit<DbRentalSession, 'id' | 'created_at' | 'updated_at' | 'session_code'> & { id?: string; session_code?: string };
        Update: Partial<Omit<DbRentalSession, 'id' | 'created_at'>>;
        Relationships: [];
      };
      session_events: {
        Row: DbSessionEvent;
        Insert: Omit<DbSessionEvent, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Omit<DbSessionEvent, 'id' | 'created_at'>>;
        Relationships: [];
      };
      rewards: {
        Row: DbReward;
        Insert: Omit<DbReward, 'id' | 'created_at' | 'updated_at' | 'code'> & { id?: string; code?: string };
        Update: Partial<Omit<DbReward, 'id' | 'created_at'>>;
        Relationships: [];
      };
      hardware_commands: {
        Row: DbHardwareCommand;
        Insert: Omit<DbHardwareCommand, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Omit<DbHardwareCommand, 'id' | 'created_at'>>;
        Relationships: [];
      };
      hardware_events: {
        Row: DbHardwareEvent;
        Insert: Omit<DbHardwareEvent, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Omit<DbHardwareEvent, 'id' | 'created_at'>>;
        Relationships: [];
      };
      support_tickets: {
        Row: DbSupportTicket;
        Insert: Omit<DbSupportTicket, 'id' | 'created_at' | 'updated_at' | 'ticket_number'> & { id?: string; ticket_number?: string };
        Update: Partial<Omit<DbSupportTicket, 'id' | 'created_at'>>;
        Relationships: [];
      };
      analytics_daily: {
        Row: DbAnalyticsDaily;
        Insert: Omit<DbAnalyticsDaily, 'id' | 'computed_at'> & { id?: string };
        Update: Partial<Omit<DbAnalyticsDaily, 'id'>>;
        Relationships: [];
      };
      system_settings: {
        Row: DbSystemSetting;
        Insert: DbSystemSetting;
        Update: Partial<Omit<DbSystemSetting, 'key'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      generate_session_code: {
        Args: Record<string, never>;
        Returns: string;
      };
      generate_reward_code: {
        Args: Record<string, never>;
        Returns: string;
      };
      calculate_session_charge: {
        Args: {
          p_duration_minutes: number;
          p_hourly_rate: number;
          p_daily_cap: number;
        };
        Returns: number;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_staff: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      get_rental_user_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
    };
    Enums: {
      session_status: SessionStatus;
      station_status: StationStatus;
      slot_status: SlotStatus;
      reward_status: RewardStatus;
      payment_status: PaymentStatus;
      power_bank_status: PowerBankStatus;
      command_type: CommandType;
      command_status: CommandStatus;
      event_type: EventType;
      support_category: SupportCategory;
      support_priority: SupportPriority;
      support_status: SupportStatus;
    };
  };
}
