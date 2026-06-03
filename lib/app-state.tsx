'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  type ActiveSession,
  type UserReward,
  type StationInfo,
  type UserInfo,
  type RentalState,
  calculateCharge,
} from './session-store';
import { createClient } from '@/lib/supabase/client';

// App-level state that persists across tab navigation
interface AppState {
  // Loading state
  isLoading: boolean;

  // User
  user: UserInfo | null;
  setUser: (user: UserInfo | null) => void;

  // Active rental session
  activeSession: ActiveSession | null;
  setActiveSession: (session: ActiveSession | null) => void;
  
  // Completed session (for reward claiming)
  completedSession: ActiveSession | null;
  setCompletedSession: (session: ActiveSession | null) => void;

  // Station info (from QR scan or selection)
  currentStation: StationInfo | null;
  setCurrentStation: (station: StationInfo | null) => void;
  loadStation: (stationId: string) => Promise<StationInfo | null>;

  // Rewards
  rewards: UserReward[];
  addReward: (reward: UserReward) => void;
  updateReward: (rewardId: string, updates: Partial<UserReward>) => void;
  loadUserRewards: () => Promise<void>;

  // Actions
  startRental: (userInfo: UserInfo) => Promise<{ success: boolean; error?: string }>;
  completeRental: () => Promise<{ success: boolean; qualifiedForReward: boolean }>;
  cancelRental: () => void;
  redeemReward: (rewardId: string) => Promise<{ success: boolean }>;

  // State management
  refreshActiveSession: () => Promise<void>;
  clearAllState: () => void;
}

const AppStateContext = createContext<AppState | null>(null);

// Storage keys for offline-first caching
const STORAGE_KEYS = {
  user: 'powerdon_user',
  session: 'powerdon_session',
  rewards: 'powerdon_rewards',
} as const;

// Safe localStorage access
function getStoredItem<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    const parsed = JSON.parse(item);
    // Convert date strings back to Date objects
    if (parsed?.startTime) parsed.startTime = new Date(parsed.startTime);
    if (parsed?.lastSyncTime) parsed.lastSyncTime = new Date(parsed.lastSyncTime);
    if (parsed?.issuedAt) parsed.issuedAt = new Date(parsed.issuedAt);
    if (parsed?.expiresAt) parsed.expiresAt = new Date(parsed.expiresAt);
    if (Array.isArray(parsed)) {
      return parsed.map(item => {
        if (item?.issuedAt) item.issuedAt = new Date(item.issuedAt);
        if (item?.expiresAt) item.expiresAt = new Date(item.expiresAt);
        if (item?.redeemedAt) item.redeemedAt = new Date(item.redeemedAt);
        return item;
      }) as T;
    }
    return parsed as T;
  } catch {
    return null;
  }
}

function setStoredItem(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable
  }
}

function removeStoredItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore errors
  }
}

// Transform database session to app session format
function transformDbSession(dbSession: {
  id: string;
  session_code: string;
  started_at: string | null;
  duration_minutes: number | null;
  hourly_rate: number;
  deposit_amount: number;
  rental_charge: number | null;
  status: string;
  start_station?: { id: string; name: string | null; device_id: string } | null;
  start_slot_number: number;
  campaign?: { 
    id: string; 
    name: string;
    reward_threshold_minutes: number;
    reward_description: string | null;
    deposit_amount: number;
  } | null;
}): ActiveSession {
  const dailyCap = 27.00; // EUR daily cap from pricing rules
  return {
    id: dbSession.id,
    sessionCode: dbSession.session_code,
    stationId: dbSession.start_station?.device_id || 'UNKNOWN',
    stationName: dbSession.start_station?.name || 'Unknown Station',
    slotNumber: dbSession.start_slot_number,
    startTime: dbSession.started_at ? new Date(dbSession.started_at) : new Date(),
    elapsedMinutes: dbSession.duration_minutes || 0,
    hourlyRate: dbSession.hourly_rate,
    dailyCap,
    depositAmount: dbSession.deposit_amount,
    currentCharge: dbSession.rental_charge || 0,
    rewardThreshold: dbSession.campaign?.reward_threshold_minutes || 60,
    rewardDescription: dbSession.campaign?.reward_description || 'Complete rental to earn rewards',
    campaignId: dbSession.campaign?.id || null,
    campaignName: dbSession.campaign?.name || 'Standard Rental',
    status: dbSession.status as RentalState,
    lastSyncTime: new Date(),
  };
}

// Transform database reward to app reward format
function transformDbReward(dbReward: {
  id: string;
  reward_code: string | null;
  reward_type: string;
  reward_value: number;
  description: string | null;
  required_minutes: number;
  actual_minutes: number | null;
  status: string;
  created_at: string;
  expires_at: string | null;
  claimed_at: string | null;
  campaign?: { name: string } | null;
}): UserReward {
  return {
    id: dbReward.id,
    sessionId: dbReward.id,
    rewardCode: dbReward.reward_code || '',
    type: dbReward.reward_type as 'voucher' | 'discount' | 'freebie',
    value: dbReward.reward_value,
    description: dbReward.description || 'Reward',
    qualificationMinutes: dbReward.required_minutes,
    actualMinutes: dbReward.actual_minutes || 0,
    status: dbReward.status as 'earned' | 'redeemed' | 'expired',
    issuedAt: new Date(dbReward.created_at),
    expiresAt: dbReward.expires_at ? new Date(dbReward.expires_at) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    redeemedAt: dbReward.claimed_at ? new Date(dbReward.claimed_at) : undefined,
    redemptionLocation: undefined,
    campaignName: dbReward.campaign?.name || 'Reward',
  };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUserState] = useState<UserInfo | null>(null);
  const [activeSession, setActiveSessionState] = useState<ActiveSession | null>(null);
  const [completedSession, setCompletedSession] = useState<ActiveSession | null>(null);
  const [currentStation, setCurrentStation] = useState<StationInfo | null>(null);
  const [rewards, setRewards] = useState<UserReward[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load station from database
  const loadStation = useCallback(async (stationId: string): Promise<StationInfo | null> => {
    const supabase = createClient();
    
    // Try by device_id first, then by UUID
    let query = supabase
      .from('stations')
      .select(`
        id,
        device_id,
        name,
        location_description,
        total_slots,
        status,
        campaign:campaigns(
          id,
          name,
          hourly_rate,
          deposit_amount,
          reward_threshold_minutes,
          reward_description
        )
      `)
      .eq('device_id', stationId)
      .single();

    let { data, error } = await query;

    // If not found by device_id, try UUID
    if (error && stationId.includes('-')) {
      const uuidQuery = await supabase
        .from('stations')
        .select(`
          id,
          device_id,
          name,
          location_description,
          total_slots,
          status,
          campaign:campaigns(
            id,
            name,
            hourly_rate,
            deposit_amount,
            reward_threshold_minutes,
            reward_description
          )
        `)
        .eq('id', stationId)
        .single();
      data = uuidQuery.data;
      error = uuidQuery.error;
    }

    if (error || !data) {
      console.error('[AppState] Failed to load station:', error);
      return null;
    }

    // Get available slots count
    const { count: availableCount } = await supabase
      .from('slots')
      .select('id', { count: 'exact', head: true })
      .eq('station_id', data.id)
      .eq('status', 'available');

    const campaign = Array.isArray(data.campaign) ? data.campaign[0] : data.campaign;

    const station: StationInfo = {
      id: data.device_id,
      name: data.name || 'PowerDon Station',
      location: data.location_description || '',
      status: data.status as 'online' | 'offline' | 'maintenance',
      availableSlots: availableCount || 0,
      totalSlots: data.total_slots,
      campaignId: campaign?.id || null,
      campaignName: campaign?.name || 'Standard Rental',
      hourlyRate: campaign?.hourly_rate || 4.00,
      dailyCap: 27.00,
      depositAmount: campaign?.deposit_amount || 28.00,
      rewardThreshold: campaign?.reward_threshold_minutes || 60,
      rewardDescription: campaign?.reward_description || 'Complete rental to earn rewards',
    };

    setCurrentStation(station);
    return station;
  }, []);

  // Load user rewards from database
  const loadUserRewards = useCallback(async () => {
    if (!user?.email) return;

    const supabase = createClient();
    
    // Get user ID from email
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .single();

    if (!dbUser) return;

    const { data: dbRewards } = await supabase
      .from('rewards')
      .select(`
        id,
        reward_code,
        reward_type,
        reward_value,
        description,
        required_minutes,
        actual_minutes,
        status,
        created_at,
        expires_at,
        claimed_at,
        campaign:campaigns(name)
      `)
      .eq('user_id', dbUser.id)
      .order('created_at', { ascending: false });

    if (dbRewards) {
      const transformedRewards = dbRewards.map(r => transformDbReward(r as Parameters<typeof transformDbReward>[0]));
      setRewards(transformedRewards);
      setStoredItem(STORAGE_KEYS.rewards, transformedRewards);
    }
  }, [user?.email]);

  // Refresh active session from database
  const refreshActiveSession = useCallback(async () => {
    if (!user?.email) return;

    const supabase = createClient();
    
    // Get user ID
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .single();

    if (!dbUser) return;

    // Get active session
    const { data: dbSession } = await supabase
      .from('rental_sessions')
      .select(`
        id,
        session_code,
        started_at,
        duration_minutes,
        hourly_rate,
        deposit_amount,
        rental_charge,
        status,
        start_slot_number,
        start_station:stations!start_station_id(id, name, device_id),
        campaign:campaigns(id, name, reward_threshold_minutes, reward_description, deposit_amount)
      `)
      .eq('user_id', dbUser.id)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (dbSession) {
      const session = transformDbSession(dbSession as Parameters<typeof transformDbSession>[0]);
      // Update elapsed time based on start time
      if (session.startTime) {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - session.startTime.getTime()) / 60000);
        session.elapsedMinutes = elapsed;
        session.currentCharge = calculateCharge(elapsed, session.hourlyRate, session.dailyCap);
      }
      setActiveSessionState(session);
      setStoredItem(STORAGE_KEYS.session, session);
    } else {
      setActiveSessionState(null);
      removeStoredItem(STORAGE_KEYS.session);
    }
  }, [user?.email]);

  // Load from localStorage on mount, then sync with database
  useEffect(() => {
    const storedUser = getStoredItem<UserInfo>(STORAGE_KEYS.user);
    const storedSession = getStoredItem<ActiveSession>(STORAGE_KEYS.session);
    const storedRewards = getStoredItem<UserReward[]>(STORAGE_KEYS.rewards);

    if (storedUser) setUserState(storedUser);
    if (storedSession) setActiveSessionState(storedSession);
    if (storedRewards) setRewards(storedRewards);
    
    setIsHydrated(true);
    setIsLoading(false);
  }, []);

  // Sync with database when user is set
  useEffect(() => {
    if (isHydrated && user?.email) {
      refreshActiveSession();
      loadUserRewards();
    }
  }, [isHydrated, user?.email, refreshActiveSession, loadUserRewards]);

  // Persist user to localStorage
  const setUser = useCallback((newUser: UserInfo | null) => {
    setUserState(newUser);
    if (newUser) {
      setStoredItem(STORAGE_KEYS.user, newUser);
    } else {
      removeStoredItem(STORAGE_KEYS.user);
    }
  }, []);

  // Persist session to localStorage
  const setActiveSession = useCallback((session: ActiveSession | null) => {
    setActiveSessionState(session);
    if (session) {
      setStoredItem(STORAGE_KEYS.session, session);
    } else {
      removeStoredItem(STORAGE_KEYS.session);
    }
  }, []);

  // Add reward
  const addReward = useCallback((reward: UserReward) => {
    setRewards(prev => {
      const updated = [...prev, reward];
      setStoredItem(STORAGE_KEYS.rewards, updated);
      return updated;
    });
  }, []);

  // Update reward
  const updateReward = useCallback((rewardId: string, updates: Partial<UserReward>) => {
    setRewards(prev => {
      const updated = prev.map(r => r.id === rewardId ? { ...r, ...updates } : r);
      setStoredItem(STORAGE_KEYS.rewards, updated);
      return updated;
    });
  }, []);

  // Start rental flow - calls real API
  const startRental = useCallback(async (userInfo: UserInfo): Promise<{ success: boolean; error?: string }> => {
    if (!currentStation) {
      return { success: false, error: 'No station selected. Please scan a QR code.' };
    }

    if (activeSession) {
      return { success: false, error: 'You already have an active rental. Please return it first.' };
    }

    const supabase = createClient();
    
    try {
      // Get or create user
      let { data: dbUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', userInfo.email)
        .single();

      if (!dbUser) {
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            email: userInfo.email,
            name: userInfo.name,
            phone: userInfo.phone,
            terms_accepted_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (createError) {
          return { success: false, error: 'Failed to create user account.' };
        }
        dbUser = newUser;
      }

      // Get station UUID from device_id
      const { data: station } = await supabase
        .from('stations')
        .select('id, campaign_id')
        .eq('device_id', currentStation.id)
        .single();

      if (!station) {
        return { success: false, error: 'Station not found.' };
      }

      // Find available slot
      const { data: slot } = await supabase
        .from('slots')
        .select('id, slot_number')
        .eq('station_id', station.id)
        .eq('status', 'available')
        .limit(1)
        .single();

      if (!slot) {
        return { success: false, error: 'No available power banks at this station.' };
      }

      // Generate session code
      const sessionCode = `PD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Create rental session
      const { data: session, error: sessionError } = await supabase
        .from('rental_sessions')
        .insert({
          session_code: sessionCode,
          user_id: dbUser.id,
          campaign_id: station.campaign_id,
          start_station_id: station.id,
          start_slot_number: slot.slot_number,
          hourly_rate: currentStation.hourlyRate,
          deposit_amount: currentStation.depositAmount,
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .select(`
          id,
          session_code,
          started_at,
          duration_minutes,
          hourly_rate,
          deposit_amount,
          rental_charge,
          status,
          start_slot_number,
          start_station:stations!start_station_id(id, name, device_id),
          campaign:campaigns(id, name, reward_threshold_minutes, reward_description, deposit_amount)
        `)
        .single();

      if (sessionError || !session) {
        return { success: false, error: 'Failed to start rental session.' };
      }

      // Update slot status
      await supabase
        .from('slots')
        .update({ status: 'reserved' })
        .eq('id', slot.id);

      // Transform and set session
      const appSession = transformDbSession(session as Parameters<typeof transformDbSession>[0]);
      setUser(userInfo);
      setActiveSession(appSession);

      return { success: true };
    } catch (error) {
      console.error('[AppState] Start rental error:', error);
      return { success: false, error: 'An unexpected error occurred.' };
    }
  }, [currentStation, activeSession, setUser, setActiveSession]);

  // Complete rental (return power bank) - calls real API
  const completeRental = useCallback(async (): Promise<{ success: boolean; qualifiedForReward: boolean }> => {
    if (!activeSession) {
      return { success: false, qualifiedForReward: false };
    }

    const supabase = createClient();
    
    try {
      const now = new Date();
      const durationMinutes = Math.floor((now.getTime() - activeSession.startTime.getTime()) / 60000);
      const finalCharge = calculateCharge(durationMinutes, activeSession.hourlyRate, activeSession.dailyCap);
      const qualifiedForReward = durationMinutes >= activeSession.rewardThreshold;

      // Update session in database
      const { error: updateError } = await supabase
        .from('rental_sessions')
        .update({
          status: 'completed',
          ended_at: now.toISOString(),
          duration_minutes: durationMinutes,
          rental_charge: finalCharge,
          total_charge: finalCharge,
        })
        .eq('id', activeSession.id);

      if (updateError) {
        console.error('[AppState] Failed to complete rental:', updateError);
        return { success: false, qualifiedForReward: false };
      }

      // Store completed session for display
      setCompletedSession({
        ...activeSession,
        elapsedMinutes: durationMinutes,
        currentCharge: finalCharge,
        status: 'completed' as RentalState,
      });

      // Create reward if qualified
      if (qualifiedForReward && user?.email) {
        const { data: dbUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .single();

        if (dbUser && activeSession.campaignId) {
          const rewardCode = `RWD-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
          
          const { data: newReward } = await supabase
            .from('rewards')
            .insert({
              session_id: activeSession.id,
              user_id: dbUser.id,
              campaign_id: activeSession.campaignId,
              reward_type: 'voucher',
              reward_value: 10.00,
              reward_code: rewardCode,
              description: activeSession.rewardDescription,
              required_minutes: activeSession.rewardThreshold,
              actual_minutes: durationMinutes,
              status: 'qualified',
              qualified_at: now.toISOString(),
              expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .select(`
              id,
              reward_code,
              reward_type,
              reward_value,
              description,
              required_minutes,
              actual_minutes,
              status,
              created_at,
              expires_at,
              claimed_at,
              campaign:campaigns(name)
            `)
            .single();

          if (newReward) {
            addReward(transformDbReward(newReward as Parameters<typeof transformDbReward>[0]));
          }
        }
      }

      // Clear active session
      setActiveSession(null);

      return { success: true, qualifiedForReward };
    } catch (error) {
      console.error('[AppState] Complete rental error:', error);
      return { success: false, qualifiedForReward: false };
    }
  }, [activeSession, user?.email, setActiveSession, addReward]);

  // Cancel rental
  const cancelRental = useCallback(() => {
    setActiveSession(null);
    setCompletedSession(null);
  }, [setActiveSession]);

  // Redeem reward - calls real API
  const redeemReward = useCallback(async (rewardId: string): Promise<{ success: boolean }> => {
    const supabase = createClient();
    
    try {
      const { error } = await supabase
        .from('rewards')
        .update({
          status: 'claimed',
          claimed_at: new Date().toISOString(),
        })
        .eq('id', rewardId);

      if (error) {
        console.error('[AppState] Failed to redeem reward:', error);
        return { success: false };
      }

      updateReward(rewardId, {
        status: 'redeemed',
        redeemedAt: new Date(),
        redemptionLocation: 'PowerDon Booth',
      });

      return { success: true };
    } catch (error) {
      console.error('[AppState] Redeem reward error:', error);
      return { success: false };
    }
  }, [updateReward]);

  // Clear all state
  const clearAllState = useCallback(() => {
    setUserState(null);
    setActiveSessionState(null);
    setCompletedSession(null);
    setCurrentStation(null);
    setRewards([]);
    removeStoredItem(STORAGE_KEYS.user);
    removeStoredItem(STORAGE_KEYS.session);
    removeStoredItem(STORAGE_KEYS.rewards);
  }, []);

  // Update elapsed time for active session (real-time updates)
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'active') return;

    const interval = setInterval(() => {
      setActiveSessionState(prev => {
        if (!prev || !prev.startTime) return prev;
        const now = new Date();
        const newElapsed = Math.floor((now.getTime() - prev.startTime.getTime()) / 60000);
        const updated = {
          ...prev,
          elapsedMinutes: newElapsed,
          currentCharge: calculateCharge(newElapsed, prev.hourlyRate, prev.dailyCap),
          lastSyncTime: now,
        };
        setStoredItem(STORAGE_KEYS.session, updated);
        return updated;
      });
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [activeSession?.status, activeSession?.startTime]);

  // Don't render children until hydrated to avoid hydration mismatch
  if (!isHydrated) {
    return null;
  }

  return (
    <AppStateContext.Provider
      value={{
        isLoading,
        user,
        setUser,
        activeSession,
        setActiveSession,
        completedSession,
        setCompletedSession,
        currentStation,
        setCurrentStation,
        loadStation,
        rewards,
        addReward,
        updateReward,
        loadUserRewards,
        startRental,
        completeRental,
        cancelRental,
        redeemReward,
        refreshActiveSession,
        clearAllState,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}
