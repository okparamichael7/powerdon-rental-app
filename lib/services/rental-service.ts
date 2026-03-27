// Rental service - handles all rental session operations
// Mock implementation with interface ready for real backend

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
  simulateNetworkDelay, 
  createSuccessResponse, 
  createErrorResponse,
  ErrorCodes,
  generateId,
  generateSessionCode,
} from '@/lib/api/client';
import { mockSessions, mockTimelineEvents } from '@/lib/mock-data';

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

// In-memory session store for mock
let sessions: RentalSession[] = [...mockSessions];
let pendingUnlocks: Map<string, { slotNumber: number; timestamp: Date }> = new Map();

// Mock implementation
class MockRentalService implements IRentalService {
  async getSessions(filters?: SessionFilters): Promise<ApiResponse<RentalSession[]>> {
    await simulateNetworkDelay();

    let result = [...sessions];

    // Apply filters
    if (filters?.status && filters.status.length > 0) {
      result = result.filter(s => filters.status!.includes(s.status));
    }

    if (filters?.stationId) {
      result = result.filter(s => s.stationId === filters.stationId);
    }

    if (filters?.campaignId) {
      result = result.filter(s => s.campaignId === filters.campaignId);
    }

    if (filters?.userId) {
      result = result.filter(s => s.userId === filters.userId);
    }

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(s => 
        s.sessionCode.toLowerCase().includes(search) || 
        s.userEmail.toLowerCase().includes(search) ||
        s.userName?.toLowerCase().includes(search) ||
        s.stationName.toLowerCase().includes(search)
      );
    }

    if (filters?.dateRange) {
      if (filters.dateRange.from) {
        result = result.filter(s => s.startTime >= filters.dateRange!.from!);
      }
      if (filters.dateRange.to) {
        result = result.filter(s => s.startTime <= filters.dateRange!.to!);
      }
    }

    // Sort by start time (newest first) by default
    result.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    // Apply pagination
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const start = (page - 1) * limit;
    const paginated = result.slice(start, start + limit);

    return createSuccessResponse(paginated, {
      page,
      limit,
      total: result.length,
    });
  }

  async getSessionById(id: string): Promise<ApiResponse<RentalSession>> {
    await simulateNetworkDelay();

    const session = sessions.find(s => s.id === id);
    
    if (!session) {
      return createErrorResponse(
        ErrorCodes.SESSION_NOT_FOUND,
        `Session ${id} not found`
      );
    }

    return createSuccessResponse(session);
  }

  async getSessionByCode(code: string): Promise<ApiResponse<RentalSession>> {
    await simulateNetworkDelay();

    const session = sessions.find(s => s.sessionCode === code);
    
    if (!session) {
      return createErrorResponse(
        ErrorCodes.SESSION_NOT_FOUND,
        `Session with code ${code} not found`
      );
    }

    return createSuccessResponse(session);
  }

  async lookupSession(request: SessionLookupRequest): Promise<ApiResponse<RentalSession | null>> {
    await simulateNetworkDelay();

    let session: RentalSession | undefined;

    if (request.sessionId) {
      session = sessions.find(s => s.id === request.sessionId);
    } else if (request.sessionCode) {
      session = sessions.find(s => s.sessionCode === request.sessionCode);
    } else if (request.userEmail) {
      // Find most recent session for this email
      const userSessions = sessions.filter(s => s.userEmail === request.userEmail);
      session = userSessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0];
    }

    return createSuccessResponse(session || null);
  }

  async getActiveSessionByUser(userEmail: string): Promise<ApiResponse<RentalSession | null>> {
    await simulateNetworkDelay();

    const activeSession = sessions.find(
      s => s.userEmail === userEmail && s.status === 'active'
    );

    return createSuccessResponse(activeSession || null);
  }

  async startRental(request: StartRentalRequest): Promise<ApiResponse<StartRentalResponse>> {
    await simulateNetworkDelay();

    // Check if user already has an active session
    const existingActive = sessions.find(
      s => s.userEmail === request.userEmail && s.status === 'active'
    );

    if (existingActive) {
      return createErrorResponse(
        ErrorCodes.SESSION_ALREADY_ACTIVE,
        'You already have an active rental session',
        { existingSessionId: existingActive.id }
      );
    }

    const sessionId = generateId('SES');
    const sessionCode = generateSessionCode();
    const slotNumber = request.slotNumber || Math.floor(Math.random() * 12) + 1;
    const depositAmount = 25.00; // From campaign

    // Create new session
    const newSession: RentalSession = {
      id: sessionId,
      sessionCode,
      stationId: request.stationId,
      stationName: 'Main Stage Hub', // Would come from station lookup
      slotNumber,
      userId: generateId('USR'),
      userEmail: request.userEmail,
      userName: request.userName,
      status: 'pending',
      startTime: new Date(),
      depositAmount,
      amountCharged: 0,
      amountRefunded: 0,
      paymentMethod: 'Apple Pay',
      paymentStatus: 'authorized',
      rewardStatus: 'pending',
      campaignId: request.campaignId,
      campaignName: 'Sundance Merch Reward',
    };

    sessions.unshift(newSession);

    // Store pending unlock info
    pendingUnlocks.set(sessionId, { slotNumber, timestamp: new Date() });

    return createSuccessResponse({
      sessionId,
      sessionCode,
      slotNumber,
      depositAmount,
      paymentAuthorizationId: generateId('AUTH'),
      unlockToken: generateId('UNLOCK'),
    });
  }

  async unlockPowerBank(request: UnlockRequest): Promise<ApiResponse<UnlockResponse>> {
    await simulateNetworkDelay();

    const pendingInfo = pendingUnlocks.get(request.sessionId);
    if (!pendingInfo) {
      return createErrorResponse(
        ErrorCodes.SESSION_NOT_FOUND,
        'No pending unlock for this session'
      );
    }

    // Update session status
    const sessionIndex = sessions.findIndex(s => s.id === request.sessionId);
    if (sessionIndex !== -1) {
      sessions[sessionIndex] = {
        ...sessions[sessionIndex],
        status: 'active',
        startTime: new Date(),
      };
    }

    pendingUnlocks.delete(request.sessionId);

    // Simulate 5% failure rate
    if (Math.random() < 0.05) {
      return createErrorResponse(
        ErrorCodes.UNLOCK_FAILED,
        'Failed to unlock power bank. Please try again.'
      );
    }

    return createSuccessResponse({
      success: true,
      slotNumber: pendingInfo.slotNumber,
      batteryLevel: Math.floor(Math.random() * 30) + 70, // 70-100%
      estimatedChargeMinutes: Math.floor(Math.random() * 60) + 180, // 3-4 hours
    });
  }

  async returnPowerBank(request: ReturnRequest): Promise<ApiResponse<ReturnResponse>> {
    await simulateNetworkDelay();

    const sessionIndex = sessions.findIndex(s => s.id === request.sessionId);
    
    if (sessionIndex === -1) {
      return createErrorResponse(
        ErrorCodes.SESSION_NOT_FOUND,
        `Session ${request.sessionId} not found`
      );
    }

    const session = sessions[sessionIndex];

    if (session.status !== 'active') {
      return createErrorResponse(
        ErrorCodes.SESSION_ALREADY_COMPLETED,
        'This session is not currently active'
      );
    }

    const endTime = new Date();
    const durationMinutes = Math.floor((endTime.getTime() - session.startTime.getTime()) / 60000);
    const hourlyRate = 2.00;
    const dailyCap = 10.00;
    const finalCharge = Math.min((durationMinutes / 60) * hourlyRate, dailyCap);
    const depositRefundAmount = session.depositAmount;
    const rewardThreshold = 60;
    const rewardEarned = durationMinutes >= rewardThreshold;

    // Update session
    sessions[sessionIndex] = {
      ...session,
      status: 'completed',
      endTime,
      durationMinutes,
      amountCharged: Math.round(finalCharge * 100) / 100,
      amountRefunded: depositRefundAmount,
      paymentStatus: 'refunded',
      rewardStatus: rewardEarned ? 'qualified' : 'pending',
    };

    return createSuccessResponse({
      success: true,
      returnStationId: request.stationId,
      returnSlotNumber: request.slotNumber,
      finalDurationMinutes: durationMinutes,
      finalCharge: Math.round(finalCharge * 100) / 100,
      depositRefundAmount,
      rewardEarned,
      rewardId: rewardEarned ? generateId('RWD') : undefined,
    });
  }

  async cancelSession(sessionId: string): Promise<ApiResponse<void>> {
    await simulateNetworkDelay();

    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex === -1) {
      return createErrorResponse(
        ErrorCodes.SESSION_NOT_FOUND,
        `Session ${sessionId} not found`
      );
    }

    const session = sessions[sessionIndex];

    if (session.status !== 'pending') {
      return createErrorResponse(
        ErrorCodes.INVALID_REQUEST,
        'Can only cancel pending sessions'
      );
    }

    sessions[sessionIndex] = {
      ...session,
      status: 'failed',
      paymentStatus: 'refunded',
    };

    pendingUnlocks.delete(sessionId);

    return createSuccessResponse(undefined);
  }

  async getSessionTimeline(sessionId: string): Promise<ApiResponse<TimelineEvent[]>> {
    await simulateNetworkDelay();

    const session = sessions.find(s => s.id === sessionId);
    
    if (!session) {
      return createErrorResponse(
        ErrorCodes.SESSION_NOT_FOUND,
        `Session ${sessionId} not found`
      );
    }

    // Generate timeline events based on session data
    const events: TimelineEvent[] = [
      {
        id: generateId('EVT'),
        timestamp: session.startTime,
        type: 'scan',
        description: `QR code scanned at ${session.stationName}`,
        metadata: { stationId: session.stationId },
      },
      {
        id: generateId('EVT'),
        timestamp: new Date(session.startTime.getTime() + 30000),
        type: 'auth',
        description: 'User authenticated',
        metadata: { email: session.userEmail },
      },
      {
        id: generateId('EVT'),
        timestamp: new Date(session.startTime.getTime() + 60000),
        type: 'payment',
        description: `Deposit authorized via ${session.paymentMethod}`,
        metadata: { amount: `€${session.depositAmount.toFixed(2)}` },
      },
      {
        id: generateId('EVT'),
        timestamp: new Date(session.startTime.getTime() + 90000),
        type: 'unlock',
        description: `Power bank unlocked from Slot ${session.slotNumber}`,
        metadata: { slotId: session.slotNumber.toString() },
      },
    ];

    if (session.endTime) {
      events.push({
        id: generateId('EVT'),
        timestamp: session.endTime,
        type: 'return',
        description: `Power bank returned to ${session.stationName}`,
        metadata: { stationId: session.stationId },
      });

      if (session.rewardStatus === 'qualified' || session.rewardStatus === 'issued') {
        events.push({
          id: generateId('EVT'),
          timestamp: new Date(session.endTime.getTime() + 1000),
          type: 'reward',
          description: `Reward qualified - ${session.durationMinutes} min session`,
          metadata: { duration: `${session.durationMinutes} min` },
        });
      }

      events.push({
        id: generateId('EVT'),
        timestamp: new Date(session.endTime.getTime() + 2000),
        type: 'refund',
        description: `Deposit refunded to ${session.paymentMethod}`,
        metadata: { 
          amount: `€${session.depositAmount.toFixed(2)}`,
          charged: `€${session.amountCharged.toFixed(2)}`,
        },
      });
    }

    return createSuccessResponse(events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
  }
}

// Export singleton instance
export const rentalService: IRentalService = new MockRentalService();
