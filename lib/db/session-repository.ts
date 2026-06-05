// Session Repository - Database operations for rental sessions
import { createServiceClient } from '@/lib/supabase/admin';
import {
  isSchemaGapError,
  normalizeRewardRow,
  normalizeRewardRows,
  SESSION_SELECT_FULL,
  SESSION_SELECT_MINIMAL,
} from './schema-compat';
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

function stripUserMarketingFields(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const { marketing_consent: _mc, marketing_consent_at: _mca, ...rest } = payload;
  return rest;
}

function omitKeys(
  payload: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  const next = { ...payload };
  for (const key of keys) delete next[key];
  return next;
}

function buildSessionInsertPayloads(data: CreateSessionData): Record<string, unknown>[] {
  const full: Record<string, unknown> = {
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
  };

  return [
    full,
    omitKeys(full, ['unlock_token', 'unlock_token_expires_at']),
    omitKeys(full, [
      'unlock_token',
      'unlock_token_expires_at',
      'reward_status',
      'reward_threshold_minutes',
      'reward_qualified',
      'payment_authorization_id',
    ]),
    omitKeys(full, [
      'unlock_token',
      'unlock_token_expires_at',
      'reward_status',
      'reward_threshold_minutes',
      'reward_qualified',
      'payment_authorization_id',
      'daily_cap',
      'campaign_id',
    ]),
    {
      user_id: data.userId,
      pickup_station_id: data.pickupStationId,
      pickup_slot_number: data.pickupSlotNumber,
      status: 'pending',
      deposit_amount: data.depositAmount,
      hourly_rate: data.hourlyRate,
      payment_status: 'pending',
      metadata: {},
    },
    {
      user_id: data.userId,
      status: 'pending',
      deposit_amount: data.depositAmount,
      hourly_rate: data.hourlyRate,
      payment_status: 'pending',
    },
  ];
}

export interface SessionWithRelations extends DbRentalSession {
  user?: DbUser;
  pickup_station?: { id: string; name: string; location: string | null };
  return_station?: { id: string; name: string; location: string | null } | null;
  reward?: DbReward | DbReward[] | null;
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
    const supabase = await createServiceClient();

    const applyFilters = (select: string, includeStationFilter: boolean) => {
      let query = supabase
        .from('rental_sessions')
        .select(select)
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

      if (includeStationFilter && filters?.stationId) {
        query = query.or(
          `pickup_station_id.eq.${filters.stationId},return_station_id.eq.${filters.stationId}`,
        );
      }

      if (filters?.search) {
        query = query.ilike('session_code', `%${filters.search}%`);
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

      return query;
    };

    const attempts: { select: string; stationFilter: boolean }[] = [
      { select: SESSION_SELECT_FULL, stationFilter: Boolean(filters?.stationId) },
      { select: SESSION_SELECT_FULL, stationFilter: false },
      { select: SESSION_SELECT_MINIMAL, stationFilter: false },
    ];

    let lastError: { code?: string; message?: string } | null = null;
    for (const attempt of attempts) {
      const { data, error } = await applyFilters(attempt.select, attempt.stationFilter);
      if (!error) return data || [];
      if (!isSchemaGapError(error)) throw error;
      lastError = error;
    }

    throw lastError ?? new Error('Failed to load sessions');
  }

  private async getOneWithSchemaFallback(
    supabase: ReturnType<typeof createServiceClient>,
    column: 'id' | 'session_code',
    value: string,
  ): Promise<SessionWithRelations | null> {
    const selects = [
      `${SESSION_SELECT_FULL}, events:session_events(*)`,
      `${SESSION_SELECT_MINIMAL}, events:session_events(*)`,
      SESSION_SELECT_MINIMAL,
    ];

    let lastError: { code?: string; message?: string } | null = null;
    for (const select of selects) {
      const { data, error } = await supabase
        .from('rental_sessions')
        .select(select)
        .eq(column, value)
        .single();

      if (!error) return data;
      if (error.code === 'PGRST116') return null;
      if (!isSchemaGapError(error)) throw error;
      lastError = error;
    }

    throw lastError ?? new Error('Failed to load session');
  }

  async getById(id: string): Promise<SessionWithRelations | null> {
    const supabase = await createServiceClient();
    return this.getOneWithSchemaFallback(supabase, 'id', id);
  }

  async getByCode(code: string): Promise<SessionWithRelations | null> {
    const supabase = await createServiceClient();
    return this.getOneWithSchemaFallback(supabase, 'session_code', code);
  }

  async getActiveByUserId(userId: string): Promise<SessionWithRelations | null> {
    const supabase = await createServiceClient();
    const selects = [SESSION_SELECT_FULL, SESSION_SELECT_MINIMAL];

    let lastError: { code?: string; message?: string } | null = null;
    for (const select of selects) {
      const { data, error } = await supabase
        .from('rental_sessions')
        .select(select)
        .eq('user_id', userId)
        .in('status', ['pending', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error) return data;
      if (!isSchemaGapError(error)) throw error;
      lastError = error;
    }

    throw lastError ?? new Error('Failed to load active session');
  }

  async getActiveByUserEmail(email: string): Promise<SessionWithRelations | null> {
    const supabase = await createServiceClient();
    
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
    const supabase = await createServiceClient();

    let lastError: { code?: string; message?: string } | null = null;
    for (const payload of buildSessionInsertPayloads(data)) {
      const { data: session, error } = await supabase
        .from('rental_sessions')
        .insert(payload)
        .select()
        .single();

      if (!error) return session as DbRentalSession;
      if (!isSchemaGapError(error)) throw error;
      lastError = error;
    }

    throw lastError ?? new Error('Failed to create rental session');
  }

  async update(id: string, updates: Database['public']['Tables']['rental_sessions']['Update']): Promise<DbRentalSession> {
    const supabase = await createServiceClient();
    
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
    const supabase = await createServiceClient();
    
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
    const supabase = await createServiceClient();
    
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
    const supabase = await createServiceClient();
    
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
    const supabase = await createServiceClient();
    
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
    const supabase = await createServiceClient();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('rental_sessions')
      .select('status, amount_charged')
      .gte('created_at', today.toISOString());

    if (error) throw error;

    const sessions = (data || []) as Pick<DbRentalSession, 'status' | 'amount_charged'>[];
    return {
      totalSessions: sessions.length,
      completedSessions: sessions.filter((s) => s.status === 'completed').length,
      activeSessions: sessions.filter((s) => s.status === 'active' || s.status === 'pending').length,
      totalRevenue: sessions.reduce((sum, s) => sum + (s.amount_charged || 0), 0),
    };
  }

  // ============================================================================
  // EXPIRATION
  // ============================================================================

  async expirePendingSessions(timeoutMinutes = 15): Promise<number> {
    const supabase = await createServiceClient();
    
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
    const supabase = await createServiceClient();
    
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
  async getAll(filters?: { search?: string; marketingConsent?: boolean; limit?: number }): Promise<DbUser[]> {
    const supabase = createServiceClient();
    let query = supabase.from('users').select('*').order('created_at', { ascending: false });
    if (filters?.marketingConsent !== undefined) {
      query = query.eq('marketing_consent', filters.marketingConsent);
    }
    if (filters?.search) {
      query = query.or(`email.ilike.%${filters.search}%,name.ilike.%${filters.search}%`);
    }
    if (filters?.limit) query = query.limit(filters.limit);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getById(id: string): Promise<DbUser | null> {
    const supabase = await createServiceClient();
    
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
    const supabase = await createServiceClient();
    
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
    const supabase = await createServiceClient();
    
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
    const supabase = await createServiceClient();

    const basePayload: Record<string, unknown> = {
      email: user.email.toLowerCase(),
      name: user.name,
      phone: user.phone,
      auth_user_id: user.authUserId,
      stripe_customer_id: user.stripeCustomerId,
      total_rentals: 0,
      total_spent: 0,
      total_rewards_earned: 0,
      metadata: {},
    };

    const payloads: Record<string, unknown>[] = [
      {
        ...basePayload,
        marketing_consent: user.marketingConsent || false,
        marketing_consent_at: user.marketingConsent ? new Date().toISOString() : null,
      },
      basePayload,
      { email: user.email.toLowerCase(), name: user.name, phone: user.phone },
    ];

    let lastError: { code?: string; message?: string } | null = null;
    for (const payload of payloads) {
      const { data, error } = await supabase.from('users').insert(payload).select().single();
      if (!error) return data as DbUser;
      if (!isSchemaGapError(error)) throw error;
      lastError = error;
    }

    throw lastError ?? new Error('Failed to create user');
  }

  async update(id: string, updates: Database['public']['Tables']['users']['Update']): Promise<DbUser> {
    const supabase = await createServiceClient();

    const payloads: Record<string, unknown>[] = [
      updates as Record<string, unknown>,
      stripUserMarketingFields(updates as Record<string, unknown>),
    ];

    let lastError: { code?: string; message?: string } | null = null;
    for (const payload of payloads) {
      if (Object.keys(payload).length === 0) continue;
      const { data, error } = await supabase
        .from('users')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (!error) return data as DbUser;
      if (!isSchemaGapError(error)) throw error;
      lastError = error;
    }

    throw lastError ?? new Error('Failed to update user');
  }

  async getOrCreate(email: string, data?: {
    name?: string;
    phone?: string;
    marketingConsent?: boolean;
  }): Promise<DbUser> {
    const existing = await this.getByEmail(email);
    
    if (existing) {
      const updates: Database['public']['Tables']['users']['Update'] = {};
      if (data?.name) updates.name = data.name;
      if (data?.phone) updates.phone = data.phone;
      if (data?.marketingConsent !== undefined) {
        updates.marketing_consent = data.marketingConsent;
        if (data.marketingConsent && !existing.marketing_consent) {
          updates.marketing_consent_at = new Date().toISOString();
        }
      }
      if (Object.keys(updates).length > 0) {
        return this.update(existing.id, updates);
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
  private applyRewardFilters<T extends { in: (col: string, vals: string[]) => T; ilike: (col: string, pattern: string) => T; limit: (n: number) => T }>(
    query: T,
    filters?: { status?: string[]; search?: string; limit?: number },
  ): T {
    if (filters?.status?.length) query = query.in('status', filters.status);
    if (filters?.search) query = query.ilike('code', `%${filters.search}%`);
    if (filters?.limit) query = query.limit(filters.limit);
    return query;
  }

  async getAll(filters?: { status?: string[]; search?: string; limit?: number }): Promise<DbReward[]> {
    const supabase = createServiceClient();
    const orderAttempts = ['issued_at', 'created_at'] as const;

    let lastError: { code?: string; message?: string } | null = null;
    for (const orderCol of orderAttempts) {
      const query = this.applyRewardFilters(
        supabase.from('rewards').select('*').order(orderCol, { ascending: false }),
        filters,
      );
      const { data, error } = await query;
      if (!error) return normalizeRewardRows(data as Record<string, unknown>[] | null);
      if (!isSchemaGapError(error)) throw error;
      lastError = error;
    }

    throw lastError ?? new Error('Failed to load rewards');
  }

  private async getOneReward(
    column: 'id' | 'code' | 'session_id',
    value: string,
  ): Promise<DbReward | null> {
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq(column, value)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return normalizeRewardRow(data as Record<string, unknown>);
  }

  async getById(id: string): Promise<DbReward | null> {
    return this.getOneReward('id', id);
  }

  async getByCode(code: string): Promise<DbReward | null> {
    return this.getOneReward('code', code);
  }

  async getBySessionId(sessionId: string): Promise<DbReward | null> {
    return this.getOneReward('session_id', sessionId);
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
    const supabase = await createServiceClient();
    const now = new Date().toISOString();
    const base = {
      session_id: reward.sessionId,
      user_id: reward.userId,
      campaign_id: reward.campaignId,
      reward_type: reward.rewardType,
      description: reward.description,
      status: 'qualified' as const,
      expires_at: reward.expiresAt.toISOString(),
      metadata: {},
    };

    const payloads: Record<string, unknown>[] = [
      { ...base, value: reward.value, issued_at: now },
      { ...base, reward_value: reward.value },
    ];

    let lastError: { code?: string; message?: string } | null = null;
    for (const payload of payloads) {
      const { data, error } = await supabase.from('rewards').insert(payload).select().single();
      if (!error) return normalizeRewardRow(data as Record<string, unknown>);
      if (!isSchemaGapError(error)) throw error;
      lastError = error;
    }

    throw lastError ?? new Error('Failed to create reward');
  }

  async issue(id: string): Promise<DbReward> {
    const supabase = await createServiceClient();
    
    const { data, error } = await supabase
      .from('rewards')
      .update({ status: 'issued' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return normalizeRewardRow(data as Record<string, unknown>);
  }

  async redeem(id: string, data: {
    redemptionLocation?: string;
    redeemedByStaffId?: string;
  }): Promise<DbReward> {
    const supabase = await createServiceClient();
    const now = new Date().toISOString();
    const updates: Record<string, unknown>[] = [
      {
        status: 'redeemed',
        redeemed_at: now,
        redemption_location: data.redemptionLocation,
        redeemed_by_staff_id: data.redeemedByStaffId,
      },
      { status: 'redeemed' },
    ];

    let lastError: { code?: string; message?: string } | null = null;
    for (const patch of updates) {
      const { data: reward, error } = await supabase
        .from('rewards')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (!error) return normalizeRewardRow(reward as Record<string, unknown>);
      if (!isSchemaGapError(error)) throw error;
      lastError = error;
    }

    throw lastError ?? new Error('Failed to redeem reward');
  }

  async expireOldRewards(): Promise<number> {
    const supabase = await createServiceClient();
    
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
