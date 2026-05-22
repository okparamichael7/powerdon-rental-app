// Session Repository - Database operations for rental sessions
import { createClient } from '@/lib/supabase/server';
import type { 
  Database, 
  DbRentalSession, 
  DbSessionEvent, 
  DbUser, 
  DbReward,
  SessionStatus, 
  PaymentStatus,
  RewardStatus,
  EventType 
} from './types';

export interface SessionWithRelations extends DbRentalSession {
  user?: DbUser;
  pickup_station?: { id: string; name: string; location: string | null };
  return_station?: { id: string; name: string; location: string | null } | null;
  reward?: DbReward | null;
  events?: DbSessionEvent[];
}

export interface SessionFilters {
  status?: SessionStatus[];
  userId?: string;
  userEmail?: string;
  campaignId?: string;
  stationId?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface CreateSessionData {
  userId: string;
  campaignId?: string;
  pickupStationId: string;
  pickupSlotNumber: number;
  powerBankId?: string;
  depositAmount: number;
  hourlyRate: number;
  dailyCap: number;
  rewardThresholdMinutes?: number;
  paymentMethod?: string;
  paymentIntentId?: string;
  paymentAuthorizationId?: string;
  unlockToken?: string;
  unlockTokenExpiresAt?: Date;
}

class SessionRepository {
  // ============================================================================
  // SESSIONS
  // ============================================================================

  async getAll(filters?: SessionFilters): Promise<SessionWithRelations[]> {
    const supabase = await createClient();
    
    let query = supabase
      .from('rental_sessions')
      .select(`
        *,
        user:users(*),
        pickup_station:stations!pickup_station_id(id, name, location),
        return_station:stations!return_station_id(id, name, location),
        reward:rewards(*)
      `)
      .order('created_at', { ascending: false });

    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters?.campaignId) {
      query = query.eq('campaign_id', filters.campaignId);
    }

    if (filters?.stationId) {
      query = query.or(`pickup_station_id.eq.${filters.stationId},return_station_id.eq.${filters.stationId}`);
    }

    if (filters?.search) {
      query = query.or(`session_code.ilike.%${filters.search}%`);
    }

    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }

    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async getById(id: string): Promise<SessionWithRelations | null> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('rental_sessions')
      .select(`
        *,
        user:users(*),
        pickup_station:stations!pickup_station_id(id, name, location),
        return_station:stations!return_station_id(id, name, location),
        reward:rewards(*),
        events:session_events(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async getByCode(code: string): Promise<SessionWithRelations | null> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('rental_sessions')
      .select(`
        *,
        user:users(*),
        pickup_station:stations!pickup_station_id(id, name, location),
        return_station:stations!return_station_id(id, name, location),
        reward:rewards(*),
        events:session_events(*)
      `)
      .eq('session_code', code)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async getActiveByUserId(userId: string): Promise<SessionWithRelations | null> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('rental_sessions')
      .select(`
        *,
        user:users(*),
        pickup_station:stations!pickup_station_id(id, name, location),
        return_station:stations!return_station_id(id, name, location)
      `)
      .eq('user_id', userId)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async getActiveByUserEmail(email: string): Promise<SessionWithRelations | null> {
    const supabase = await createClient();
    
    // First get user by email
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (!user) return null;

    return this.getActiveByUserId(user.id);
  }

  async create(data: CreateSessionData): Promise<DbRentalSession> {
    const supabase = await createClient();
    
    const { data: session, error } = await supabase
      .from('rental_sessions')
      .insert({
        user_id: data.userId,
        campaign_id: data.campaignId,
        pickup_station_id: data.pickupStationId,
        pickup_slot_number: data.pickupSlotNumber,
        power_bank_id: data.powerBankId,
        status: 'pending',
        deposit_amount: data.depositAmount,
        hourly_rate: data.hourlyRate,
        daily_cap: data.dailyCap,
        reward_threshold_minutes: data.rewardThresholdMinutes,
        payment_method: data.paymentMethod,
        payment_intent_id: data.paymentIntentId,
        payment_authorization_id: data.paymentAuthorizationId,
        payment_status: 'pending',
        reward_status: 'pending',
        unlock_token: data.unlockToken,
        unlock_token_expires_at: data.unlockTokenExpiresAt?.toISOString(),
        metadata: {},
      })
      .select()
      .single();

    if (error) throw error;
    return session;
  }

  async update(id: string, updates: Database['public']['Tables']['rental_sessions']['Update']): Promise<DbRentalSession> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('rental_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateStatus(id: string, status: SessionStatus): Promise<DbRentalSession> {
    return this.update(id, { status });
  }

  async startSession(id: string, powerBankId?: string): Promise<DbRentalSession> {
    return this.update(id, {
      status: 'active',
      started_at: new Date().toISOString(),
      power_bank_id: powerBankId,
      payment_status: 'authorized',
    });
  }

  async completeSession(id: string, data: {
    returnStationId: string;
    returnSlotNumber: number;
    durationMinutes: number;
    amountCharged: number;
    amountRefunded: number;
    rewardQualified: boolean;
  }): Promise<DbRentalSession> {
    return this.update(id, {
      status: 'completed',
      ended_at: new Date().toISOString(),
      return_station_id: data.returnStationId,
      return_slot_number: data.returnSlotNumber,
      duration_minutes: data.durationMinutes,
      amount_charged: data.amountCharged,
      amount_refunded: data.amountRefunded,
      payment_status: 'refunded',
      reward_qualified: data.rewardQualified,
      reward_status: data.rewardQualified ? 'qualified' : 'pending',
    });
  }

  async cancelSession(id: string, reason?: string): Promise<DbRentalSession> {
    return this.update(id, {
      status: 'cancelled',
      ended_at: new Date().toISOString(),
      payment_status: 'cancelled',
      metadata: reason ? { cancellation_reason: reason } : undefined,
    });
  }

  async expireSession(id: string): Promise<DbRentalSession> {
    return this.update(id, {
      status: 'expired',
      ended_at: new Date().toISOString(),
    });
  }

  async delete(id: string): Promise<void> {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('rental_sessions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ============================================================================
  // SESSION EVENTS
  // ============================================================================

  async addEvent(sessionId: string, event: {
    type: EventType;
    description: string;
    metadata?: Record<string, unknown>;
    actorType?: string;
    actorId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<DbSessionEvent> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('session_events')
      .insert({
        session_id: sessionId,
        event_type: event.type,
        description: event.description,
        metadata: event.metadata || {},
        actor_type: event.actorType || 'system',
        actor_id: event.actorId,
        ip_address: event.ipAddress,
        user_agent: event.userAgent,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getEvents(sessionId: string): Promise<DbSessionEvent[]> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('session_events')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  async getActiveCount(): Promise<number> {
    const supabase = await createClient();
    
    const { count, error } = await supabase
      .from('rental_sessions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'active']);

    if (error) throw error;
    return count || 0;
  }

  async getTodayStats(): Promise<{
    totalSessions: number;
    completedSessions: number;
    activeSessions: number;
    totalRevenue: number;
  }> {
    const supabase = await createClient();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('rental_sessions')
      .select('status, amount_charged')
      .gte('created_at', today.toISOString());

    if (error) throw error;

    const sessions = data || [];
    return {
      totalSessions: sessions.length,
      completedSessions: sessions.filter(s => s.status === 'completed').length,
      activeSessions: sessions.filter(s => s.status === 'active' || s.status === 'pending').length,
      totalRevenue: sessions.reduce((sum, s) => sum + (s.amount_charged || 0), 0),
    };
  }

  // ============================================================================
  // EXPIRATION
  // ============================================================================

  async expirePendingSessions(timeoutMinutes = 15): Promise<number> {
    const supabase = await createClient();
    
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('rental_sessions')
      .update({ status: 'expired', ended_at: new Date().toISOString() })
      .eq('status', 'pending')
      .lt('created_at', cutoff)
      .select('id');

    if (error) throw error;
    return (data || []).length;
  }

  async getExpiredActiveSessions(maxHours = 48): Promise<DbRentalSession[]> {
    const supabase = await createClient();
    
    const cutoff = new Date(Date.now() - maxHours * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('rental_sessions')
      .select('*')
      .eq('status', 'active')
      .lt('started_at', cutoff);

    if (error) throw error;
    return data || [];
  }
}

// ============================================================================
// USER REPOSITORY
// ============================================================================

class UserRepository {
  async getById(id: string): Promise<DbUser | null> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async getByEmail(email: string): Promise<DbUser | null> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async getByAuthUserId(authUserId: string): Promise<DbUser | null> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async create(user: {
    email: string;
    name?: string;
    phone?: string;
    authUserId?: string;
    marketingConsent?: boolean;
    stripeCustomerId?: string;
  }): Promise<DbUser> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: user.email.toLowerCase(),
        name: user.name,
        phone: user.phone,
        auth_user_id: user.authUserId,
        marketing_consent: user.marketingConsent || false,
        marketing_consent_at: user.marketingConsent ? new Date().toISOString() : null,
        stripe_customer_id: user.stripeCustomerId,
        total_rentals: 0,
        total_spent: 0,
        total_rewards_earned: 0,
        metadata: {},
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, updates: Database['public']['Tables']['users']['Update']): Promise<DbUser> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getOrCreate(email: string, data?: {
    name?: string;
    phone?: string;
    marketingConsent?: boolean;
  }): Promise<DbUser> {
    const existing = await this.getByEmail(email);
    
    if (existing) {
      // Update if new data provided
      if (data?.name || data?.phone || data?.marketingConsent !== undefined) {
        return this.update(existing.id, {
          name: data.name || existing.name,
          phone: data.phone || existing.phone,
          marketing_consent: data.marketingConsent ?? existing.marketing_consent,
          marketing_consent_at: data.marketingConsent && !existing.marketing_consent 
            ? new Date().toISOString() 
            : existing.marketing_consent_at,
        });
      }
      return existing;
    }

    return this.create({
      email,
      name: data?.name,
      phone: data?.phone,
      marketingConsent: data?.marketingConsent,
    });
  }
}

// ============================================================================
// REWARD REPOSITORY
// ============================================================================

class RewardRepository {
  async getById(id: string): Promise<DbReward | null> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async getByCode(code: string): Promise<DbReward | null> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('code', code)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async getBySessionId(sessionId: string): Promise<DbReward | null> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async create(reward: {
    sessionId: string;
    userId: string;
    campaignId: string;
    rewardType: string;
    value: number;
    description?: string;
    expiresAt: Date;
  }): Promise<DbReward> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('rewards')
      .insert({
        session_id: reward.sessionId,
        user_id: reward.userId,
        campaign_id: reward.campaignId,
        reward_type: reward.rewardType,
        value: reward.value,
        description: reward.description,
        status: 'qualified',
        issued_at: new Date().toISOString(),
        expires_at: reward.expiresAt.toISOString(),
        metadata: {},
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async issue(id: string): Promise<DbReward> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('rewards')
      .update({ status: 'issued' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async redeem(id: string, data: {
    redemptionLocation?: string;
    redeemedByStaffId?: string;
  }): Promise<DbReward> {
    const supabase = await createClient();
    
    const { data: reward, error } = await supabase
      .from('rewards')
      .update({
        status: 'redeemed',
        redeemed_at: new Date().toISOString(),
        redemption_location: data.redemptionLocation,
        redeemed_by_staff_id: data.redeemedByStaffId,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return reward;
  }

  async expireOldRewards(): Promise<number> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('rewards')
      .update({ status: 'expired' })
      .in('status', ['qualified', 'issued'])
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) throw error;
    return (data || []).length;
  }
}

export const sessionRepository = new SessionRepository();
export const userRepository = new UserRepository();
export const rewardRepository = new RewardRepository();
