// Rental service - handles all rental session operations
// Production implementation using Supabase

import type { RentalSession, TimelineEvent } from '@/lib/types';
import type { 
  ApiResponse, 
  SessionFilters,
  StartRentalRequest,
  StartRentalResponse,
  UnlockRequest,
  UnlockResponse,
  ReturnRequest,
  ReturnResponse,
  SessionLookupRequest,
} from '@/lib/api/types';
import { 
  createSuccessResponse, 
  createErrorResponse,
  ErrorCodes,
  generateId,
  generateSessionCode,
} from '@/lib/api/client';
import { createClient } from '@/lib/supabase/client';

// Rental service interface
export interface IRentalService {
  getSessions(filters?: SessionFilters): Promise<ApiResponse<RentalSession[]>>;
  getSessionById(id: string): Promise<ApiResponse<RentalSession>>;
  getSessionByCode(code: string): Promise<ApiResponse<RentalSession>>;
  lookupSession(request: SessionLookupRequest): Promise<ApiResponse<RentalSession | null>>;
  getActiveSessionByUser(userEmail: string): Promise<ApiResponse<RentalSession | null>>;
  startRental(request: StartRentalRequest): Promise<ApiResponse<StartRentalResponse>>;
  unlockPowerBank(request: UnlockRequest): Promise<ApiResponse<UnlockResponse>>;
  returnPowerBank(request: ReturnRequest): Promise<ApiResponse<ReturnResponse>>;
  cancelSession(sessionId: string): Promise<ApiResponse<void>>;
  getSessionTimeline(sessionId: string): Promise<ApiResponse<TimelineEvent[]>>;
}

// Transform database session to API session type
function transformSession(dbSession: {
  id: string;
  session_code: string;
  user_id: string;
  campaign_id: string | null;
  start_station_id: string;
  start_slot_number: number;
  end_station_id: string | null;
  end_slot_number: number | null;
  power_bank_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  hourly_rate: number;
  deposit_amount: number;
  rental_charge: number | null;
  total_charge: number | null;
  refund_amount: number | null;
  status: string;
  payment_intent_id: string | null;
  payment_status: string | null;
  created_at: string;
  users?: { email: string; name: string | null; phone: string | null } | null;
  start_station?: { name: string | null; location_description: string | null; device_id: string } | null;
  end_station?: { name: string | null; location_description: string | null } | null;
  campaigns?: { name: string | null } | null;
  rewards?: Array<{ id: string; status: string }> | null;
}): RentalSession {
  const rewardData = dbSession.rewards?.[0];
  return {
    id: dbSession.id,
    sessionCode: dbSession.session_code,
    status: dbSession.status as RentalSession['status'],
    userId: dbSession.user_id,
    userEmail: dbSession.users?.email || '',
    userName: dbSession.users?.name || undefined,
    userPhone: dbSession.users?.phone || undefined,
    campaignId: dbSession.campaign_id || undefined,
    campaignName: dbSession.campaigns?.name || undefined,
    stationId: dbSession.start_station?.device_id || dbSession.start_station_id,
    stationName: dbSession.start_station?.name || 'Unknown Station',
    slotNumber: dbSession.start_slot_number,
    returnStationId: dbSession.end_station_id || undefined,
    returnStationName: dbSession.end_station?.name || undefined,
    returnSlotNumber: dbSession.end_slot_number || undefined,
    powerBankId: dbSession.power_bank_id || undefined,
    startTime: new Date(dbSession.started_at || dbSession.created_at),
    endTime: dbSession.ended_at ? new Date(dbSession.ended_at) : undefined,
    durationMinutes: dbSession.duration_minutes || undefined,
    hourlyRate: Number(dbSession.hourly_rate) || 4.00,
    dailyCap: 27.00, // EUR ladder pricing
    depositAmount: Number(dbSession.deposit_amount) || 28.00,
    amountCharged: dbSession.total_charge ? Number(dbSession.total_charge) : 0,
    amountRefunded: dbSession.refund_amount ? Number(dbSession.refund_amount) : 0,
    paymentMethod: 'Card',
    paymentStatus: dbSession.payment_status || 'pending',
    rewardStatus: rewardData?.status as RentalSession['rewardStatus'] || 'pending',
    rewardId: rewardData?.id,
  };
}

// Production implementation using Supabase
class SupabaseRentalService implements IRentalService {
  async getSessions(filters?: SessionFilters): Promise<ApiResponse<RentalSession[]>> {
    try {
      const supabase = createClient();
      
      let query = supabase
        .from('rental_sessions')
        .select(`
          *,
          users:user_id(email, name, phone),
          start_station:start_station_id(name, location_description, device_id),
          end_station:end_station_id(name, location_description),
          campaigns:campaign_id(name),
          rewards(id, status)
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters?.stationId) {
        query = query.or(`start_station_id.eq.${filters.stationId},end_station_id.eq.${filters.stationId}`);
      }

      if (filters?.campaignId) {
        query = query.eq('campaign_id', filters.campaignId);
      }

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters?.search) {
        query = query.ilike('session_code', `%${filters.search}%`);
      }

      if (filters?.dateRange?.from) {
        query = query.gte('created_at', filters.dateRange.from.toISOString());
      }

      if (filters?.dateRange?.to) {
        query = query.lte('created_at', filters.dateRange.to.toISOString());
      }

      // Apply pagination
      const page = filters?.page || 1;
      const limit = filters?.limit || 50;
      const start = (page - 1) * limit;
      query = query.range(start, start + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('[RentalService] Error fetching sessions:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch sessions');
      }

      const sessions = (data || []).map(transformSession);

      return createSuccessResponse(sessions, {
        page,
        limit,
        total: count || sessions.length,
      });
    } catch (err) {
      console.error('[RentalService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getSessionById(id: string): Promise<ApiResponse<RentalSession>> {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('rental_sessions')
        .select(`
          *,
          users:user_id(email, name, phone),
          start_station:start_station_id(name, location_description, device_id),
          end_station:end_station_id(name, location_description),
          campaigns:campaign_id(name),
          rewards(id, status)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[RentalService] Error fetching session:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch session');
      }

      if (!data) {
        return createErrorResponse(ErrorCodes.SESSION_NOT_FOUND, `Session ${id} not found`);
      }

      return createSuccessResponse(transformSession(data));
    } catch (err) {
      console.error('[RentalService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getSessionByCode(code: string): Promise<ApiResponse<RentalSession>> {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('rental_sessions')
        .select(`
          *,
          users:user_id(email, name, phone),
          start_station:start_station_id(name, location_description, device_id),
          end_station:end_station_id(name, location_description),
          campaigns:campaign_id(name),
          rewards(id, status)
        `)
        .eq('session_code', code.toUpperCase())
        .maybeSingle();

      if (error) {
        console.error('[RentalService] Error fetching session by code:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch session');
      }

      if (!data) {
        return createErrorResponse(ErrorCodes.SESSION_NOT_FOUND, `Session with code ${code} not found`);
      }

      return createSuccessResponse(transformSession(data));
    } catch (err) {
      console.error('[RentalService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async lookupSession(request: SessionLookupRequest): Promise<ApiResponse<RentalSession | null>> {
    try {
      if (request.sessionId) {
        const result = await this.getSessionById(request.sessionId);
        return createSuccessResponse(result.success ? result.data : null);
      }
      
      if (request.sessionCode) {
        const result = await this.getSessionByCode(request.sessionCode);
        return createSuccessResponse(result.success ? result.data : null);
      }
      
      if (request.userEmail) {
        const supabase = createClient();
        
        // First get user by email
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('email', request.userEmail.toLowerCase())
          .maybeSingle();

        if (!user) {
          return createSuccessResponse(null);
        }

        // Get most recent session for user
        const { data } = await supabase
          .from('rental_sessions')
          .select(`
            *,
            users:user_id(email, name, phone),
            start_station:start_station_id(name, location_description, device_id),
            end_station:end_station_id(name, location_description),
            campaigns:campaign_id(name),
            rewards(id, status)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return createSuccessResponse(data ? transformSession(data) : null);
      }

      return createSuccessResponse(null);
    } catch (err) {
      console.error('[RentalService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getActiveSessionByUser(userEmail: string): Promise<ApiResponse<RentalSession | null>> {
    try {
      const supabase = createClient();
      
      // First get user by email
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', userEmail.toLowerCase())
        .maybeSingle();

      if (!user) {
        return createSuccessResponse(null);
      }

      const { data, error } = await supabase
        .from('rental_sessions')
        .select(`
          *,
          users:user_id(email, name, phone),
          start_station:start_station_id(name, location_description, device_id),
          end_station:end_station_id(name, location_description),
          campaigns:campaign_id(name),
          rewards(id, status)
        `)
        .eq('user_id', user.id)
        .in('status', ['pending', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[RentalService] Error fetching active session:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch active session');
      }

      return createSuccessResponse(data ? transformSession(data) : null);
    } catch (err) {
      console.error('[RentalService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async startRental(request: StartRentalRequest): Promise<ApiResponse<StartRentalResponse>> {
    try {
      const supabase = createClient();
      
      // Check if user already has an active session
      const existingResult = await this.getActiveSessionByUser(request.userEmail);
      if (existingResult.success && existingResult.data) {
        return createErrorResponse(
          ErrorCodes.SESSION_ALREADY_ACTIVE,
          'You already have an active rental session',
          { existingSessionId: existingResult.data.id }
        );
      }

      // Get or create user
      let { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', request.userEmail.toLowerCase())
        .maybeSingle();

      if (!user) {
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            email: request.userEmail.toLowerCase(),
            name: request.userName,
            terms_accepted_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (createError) {
          console.error('[RentalService] Error creating user:', createError);
          return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to create user');
        }
        user = newUser;
      }

      // Get station info by device_id
      const { data: station, error: stationError } = await supabase
        .from('stations')
        .select('id, campaign_id, campaigns:campaign_id(hourly_rate, deposit_amount)')
        .eq('device_id', request.stationId)
        .maybeSingle();

      if (stationError || !station) {
        // Try by UUID
        const { data: stationByUuid } = await supabase
          .from('stations')
          .select('id, campaign_id, campaigns:campaign_id(hourly_rate, deposit_amount)')
          .eq('id', request.stationId)
          .maybeSingle();
        
        if (!stationByUuid) {
          return createErrorResponse(ErrorCodes.NOT_FOUND, 'Station not found');
        }
        Object.assign(station || {}, stationByUuid);
      }

      const stationData = station!;

      // Find available slot with power bank
      const { data: slot, error: slotError } = await supabase
        .from('slots')
        .select('slot_number, power_bank_id, battery_level')
        .eq('station_id', stationData.id)
        .eq('status', 'occupied')
        .gte('battery_level', 20)
        .order('battery_level', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (slotError || !slot) {
        return createErrorResponse(ErrorCodes.CONFLICT, 'No power banks available at this station');
      }

      const sessionCode = generateSessionCode();
      const campaign = stationData.campaigns as { hourly_rate: number; deposit_amount: number } | null;
      const depositAmount = campaign?.deposit_amount || 28.00;
      const hourlyRate = campaign?.hourly_rate || 4.00;

      // Create rental session
      const { data: session, error: sessionError } = await supabase
        .from('rental_sessions')
        .insert({
          session_code: sessionCode,
          user_id: user.id,
          campaign_id: stationData.campaign_id,
          start_station_id: stationData.id,
          start_slot_number: slot.slot_number,
          power_bank_id: slot.power_bank_id,
          hourly_rate: hourlyRate,
          deposit_amount: depositAmount,
          status: 'pending',
          payment_status: 'pending',
        })
        .select()
        .single();

      if (sessionError) {
        console.error('[RentalService] Error creating session:', sessionError);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to create rental session');
      }

      // Reserve the slot
      await supabase
        .from('slots')
        .update({ status: 'reserved' })
        .eq('station_id', stationData.id)
        .eq('slot_number', slot.slot_number);

      return createSuccessResponse({
        sessionId: session.id,
        sessionCode: session.session_code,
        slotNumber: slot.slot_number,
        depositAmount: Number(session.deposit_amount),
        paymentAuthorizationId: generateId('AUTH'),
        unlockToken: generateId('UNLOCK'),
      });
    } catch (err) {
      console.error('[RentalService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async unlockPowerBank(request: UnlockRequest): Promise<ApiResponse<UnlockResponse>> {
    try {
      const supabase = createClient();
      
      // Get session
      const { data: session, error: sessionError } = await supabase
        .from('rental_sessions')
        .select('id, status, start_slot_number, start_station_id')
        .eq('id', request.sessionId)
        .single();

      if (sessionError || !session) {
        return createErrorResponse(ErrorCodes.SESSION_NOT_FOUND, 'Session not found');
      }

      if (session.status !== 'pending') {
        return createErrorResponse(ErrorCodes.INVALID_REQUEST, 'Session is not pending unlock');
      }

      // Get slot battery level
      const { data: slot } = await supabase
        .from('slots')
        .select('battery_level')
        .eq('station_id', session.start_station_id)
        .eq('slot_number', session.start_slot_number)
        .single();

      // Update session to active
      const { error: updateError } = await supabase
        .from('rental_sessions')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          payment_status: 'authorized',
        })
        .eq('id', request.sessionId);

      if (updateError) {
        console.error('[RentalService] Error activating session:', updateError);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to activate session');
      }

      // Update slot status to empty (power bank dispensed)
      await supabase
        .from('slots')
        .update({ 
          status: 'empty',
          power_bank_id: null,
          battery_level: null,
        })
        .eq('station_id', session.start_station_id)
        .eq('slot_number', session.start_slot_number);

      return createSuccessResponse({
        success: true,
        slotNumber: session.start_slot_number,
        batteryLevel: slot?.battery_level || 80,
        estimatedChargeMinutes: Math.floor((slot?.battery_level || 80) * 2.5), // ~2.5 min per %
      });
    } catch (err) {
      console.error('[RentalService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async returnPowerBank(request: ReturnRequest): Promise<ApiResponse<ReturnResponse>> {
    try {
      const supabase = createClient();
      
      // Get session
      const { data: session, error: sessionError } = await supabase
        .from('rental_sessions')
        .select('*')
        .eq('id', request.sessionId)
        .single();

      if (sessionError || !session) {
        return createErrorResponse(ErrorCodes.SESSION_NOT_FOUND, `Session ${request.sessionId} not found`);
      }

      if (session.status !== 'active') {
        return createErrorResponse(ErrorCodes.SESSION_ALREADY_COMPLETED, 'This session is not currently active');
      }

      // Get return station ID
      let returnStationId = request.stationId;
      if (returnStationId && !returnStationId.includes('-')) {
        // It's a device_id, get the UUID
        const { data: station } = await supabase
          .from('stations')
          .select('id')
          .eq('device_id', returnStationId)
          .maybeSingle();
        if (station) {
          returnStationId = station.id;
        }
      }

      const endTime = new Date();
      const startTime = new Date(session.started_at || session.created_at);
      const durationMinutes = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      
      // EUR Ladder billing: first 5 min free, then €1/15min, max €27/day
      const chargeableMinutes = Math.max(0, durationMinutes - 5);
      const intervals = Math.ceil(chargeableMinutes / 15);
      const finalCharge = Math.min(intervals * 1.00, 27.00);
      const depositRefundAmount = Number(session.deposit_amount) - finalCharge;
      
      // Reward threshold is 60 minutes
      const rewardThreshold = 60;
      const rewardEarned = durationMinutes >= rewardThreshold;

      // Update session
      const { error: updateError } = await supabase
        .from('rental_sessions')
        .update({
          status: 'completed',
          ended_at: endTime.toISOString(),
          end_station_id: returnStationId || session.start_station_id,
          end_slot_number: request.slotNumber,
          duration_minutes: durationMinutes,
          rental_charge: finalCharge,
          total_charge: finalCharge,
          refund_amount: depositRefundAmount,
          payment_status: 'captured',
        })
        .eq('id', request.sessionId);

      if (updateError) {
        console.error('[RentalService] Error completing session:', updateError);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to complete rental');
      }

      // If reward earned, create reward record
      let rewardId: string | undefined;
      if (rewardEarned && session.campaign_id) {
        const { data: reward } = await supabase
          .from('rewards')
          .insert({
            session_id: session.id,
            user_id: session.user_id,
            campaign_id: session.campaign_id,
            reward_type: 'merchandise',
            reward_value: 10.00,
            actual_minutes: durationMinutes,
            required_minutes: rewardThreshold,
            status: 'qualified',
            description: 'Qualified for reward',
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          })
          .select('id')
          .single();
        
        rewardId = reward?.id;
      }

      // Update slot status (power bank returned)
      if (returnStationId && request.slotNumber) {
        await supabase
          .from('slots')
          .update({ 
            status: 'occupied',
            power_bank_id: session.power_bank_id,
            battery_level: request.batteryLevel || 20,
            is_charging: true,
          })
          .eq('station_id', returnStationId)
          .eq('slot_number', request.slotNumber);
      }

      return createSuccessResponse({
        success: true,
        returnStationId: returnStationId || session.start_station_id,
        returnSlotNumber: request.slotNumber,
        finalDurationMinutes: durationMinutes,
        finalCharge: Math.round(finalCharge * 100) / 100,
        depositRefundAmount: Math.round(depositRefundAmount * 100) / 100,
        rewardEarned,
        rewardId,
      });
    } catch (err) {
      console.error('[RentalService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async cancelSession(sessionId: string): Promise<ApiResponse<void>> {
    try {
      const supabase = createClient();
      
      // Get session to check status and get slot info
      const { data: session, error: getError } = await supabase
        .from('rental_sessions')
        .select('status, start_station_id, start_slot_number')
        .eq('id', sessionId)
        .single();

      if (getError || !session) {
        return createErrorResponse(ErrorCodes.SESSION_NOT_FOUND, `Session ${sessionId} not found`);
      }

      if (session.status !== 'pending') {
        return createErrorResponse(ErrorCodes.INVALID_REQUEST, 'Can only cancel pending sessions');
      }

      // Update session
      const { error } = await supabase
        .from('rental_sessions')
        .update({
          status: 'cancelled',
          ended_at: new Date().toISOString(),
          payment_status: 'cancelled',
        })
        .eq('id', sessionId);

      if (error) {
        console.error('[RentalService] Error cancelling session:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to cancel session');
      }

      // Release the reserved slot
      await supabase
        .from('slots')
        .update({ status: 'occupied' })
        .eq('station_id', session.start_station_id)
        .eq('slot_number', session.start_slot_number)
        .eq('status', 'reserved');

      return createSuccessResponse(undefined);
    } catch (err) {
      console.error('[RentalService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getSessionTimeline(sessionId: string): Promise<ApiResponse<TimelineEvent[]>> {
    try {
      const supabase = createClient();
      
      const { data: session, error } = await supabase
        .from('rental_sessions')
        .select(`
          *,
          start_station:start_station_id(name),
          end_station:end_station_id(name)
        `)
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        return createErrorResponse(ErrorCodes.SESSION_NOT_FOUND, `Session ${sessionId} not found`);
      }

      // Build timeline events based on session data
      const events: TimelineEvent[] = [
        {
          id: `${sessionId}-created`,
          timestamp: new Date(session.created_at),
          type: 'scan',
          description: `Session initiated at ${session.start_station?.name || 'station'}`,
          metadata: { sessionCode: session.session_code },
        },
      ];

      if (session.payment_status && session.payment_status !== 'pending') {
        events.push({
          id: `${sessionId}-payment`,
          timestamp: new Date(new Date(session.created_at).getTime() + 30000),
          type: 'payment',
          description: `Deposit of €${Number(session.deposit_amount).toFixed(2)} authorized`,
          metadata: { amount: `€${Number(session.deposit_amount).toFixed(2)}` },
        });
      }

      if (session.started_at) {
        events.push({
          id: `${sessionId}-unlock`,
          timestamp: new Date(session.started_at),
          type: 'unlock',
          description: `Power bank unlocked from Slot ${session.start_slot_number}`,
          metadata: { slotId: session.start_slot_number.toString() },
        });
      }

      if (session.ended_at) {
        events.push({
          id: `${sessionId}-return`,
          timestamp: new Date(session.ended_at),
          type: 'return',
          description: `Power bank returned to ${session.end_station?.name || session.start_station?.name || 'station'}`,
          metadata: { duration: `${session.duration_minutes || 0} min` },
        });

        if (session.refund_amount && Number(session.refund_amount) > 0) {
          events.push({
            id: `${sessionId}-refund`,
            timestamp: new Date(new Date(session.ended_at).getTime() + 1000),
            type: 'refund',
            description: `€${Number(session.refund_amount).toFixed(2)} refunded`,
            metadata: { 
              charged: `€${Number(session.total_charge || 0).toFixed(2)}`,
              refunded: `€${Number(session.refund_amount).toFixed(2)}`,
            },
          });
        }
      }

      return createSuccessResponse(events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
    } catch (err) {
      console.error('[RentalService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }
}

// Export singleton instance - now using real Supabase implementation
export const rentalService: IRentalService = new SupabaseRentalService();
