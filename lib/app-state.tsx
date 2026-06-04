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
import { isMockDataEnabled } from '@/lib/services/config';
import { getPwaDataLayer } from '@/lib/data';
import { mockStation } from './session-store';

interface AppState {
  user: UserInfo | null;
  setUser: (user: UserInfo | null) => void;
  activeSession: ActiveSession | null;
  setActiveSession: (session: ActiveSession | null) => void;
  completedSession: ActiveSession | null;
  setCompletedSession: (session: ActiveSession | null) => void;
  currentStation: StationInfo | null;
  setCurrentStation: (station: StationInfo | null) => void;
  loadStation: (stationId: string) => Promise<{ success: boolean; error?: string }>;
  rewards: UserReward[];
  addReward: (reward: UserReward) => void;
  updateReward: (rewardId: string, updates: Partial<UserReward>) => void;
  startRental: (userInfo: UserInfo, options?: { paymentMethodId?: string }) => Promise<{ success: boolean; error?: string; sessionId?: string }>;
  syncActiveSession: () => Promise<void>;
  completeRental: () => Promise<{ success: boolean; qualifiedForReward: boolean }>;
  cancelRental: () => void;
  redeemReward: (rewardId: string, rewardCode?: string) => Promise<{ success: boolean }>;
  clearAllState: () => void;
}

const AppStateContext = createContext<AppState | null>(null);

const STORAGE_KEYS = {
  user: 'powerdon_user',
  session: 'powerdon_session',
  sessionId: 'powerdon_session_id',
  rewards: 'powerdon_rewards',
  stationId: 'powerdon_station_id',
} as const;

function getStoredItem<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    const parsed = JSON.parse(item);
    if (parsed?.startTime) parsed.startTime = new Date(parsed.startTime);
    if (parsed?.lastSyncTime) parsed.lastSyncTime = new Date(parsed.lastSyncTime);
    if (parsed?.issuedAt) parsed.issuedAt = new Date(parsed.issuedAt);
    if (parsed?.expiresAt) parsed.expiresAt = new Date(parsed.expiresAt);
    if (Array.isArray(parsed)) {
      return parsed.map((row) => {
        if (row?.issuedAt) row.issuedAt = new Date(row.issuedAt);
        if (row?.expiresAt) row.expiresAt = new Date(row.expiresAt);
        if (row?.redeemedAt) row.redeemedAt = new Date(row.redeemedAt);
        return row;
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
    /* ignore */
  }
}

function removeStoredItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const useMock = isMockDataEnabled();
  const [user, setUserState] = useState<UserInfo | null>(null);
  const [activeSession, setActiveSessionState] = useState<ActiveSession | null>(null);
  const [completedSession, setCompletedSession] = useState<ActiveSession | null>(null);
  const [currentStation, setCurrentStation] = useState<StationInfo | null>(useMock ? mockStation : null);
  const [rewards, setRewards] = useState<UserReward[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  const setUser = useCallback((newUser: UserInfo | null) => {
    setUserState(newUser);
    if (newUser) setStoredItem(STORAGE_KEYS.user, newUser);
    else removeStoredItem(STORAGE_KEYS.user);
  }, []);

  const setActiveSession = useCallback((session: ActiveSession | null) => {
    setActiveSessionState(session);
    if (session) {
      setStoredItem(STORAGE_KEYS.session, session);
      setStoredItem(STORAGE_KEYS.sessionId, session.id);
    } else {
      removeStoredItem(STORAGE_KEYS.session);
      removeStoredItem(STORAGE_KEYS.sessionId);
    }
  }, []);

  const loadStation = useCallback(async (stationId: string): Promise<{ success: boolean; error?: string }> => {
    const result = await getPwaDataLayer().loadStationFromApi(stationId);
    if (!result.success || !result.station) {
      return { success: false, error: 'error' in result ? result.error : 'Station not found' };
    }
    setCurrentStation(result.station);
    setStoredItem(STORAGE_KEYS.stationId, result.station.id);
    return { success: true };
  }, []);

  const syncActiveSession = useCallback(async () => {
    const sessionId = getStoredItem<string>(STORAGE_KEYS.sessionId);
    if (!sessionId || useMock) return;
    const station = currentStation;
    if (!station) return;
    const syncResult = await getPwaDataLayer().syncSessionFromApi(sessionId, station);
    if ('terminal' in syncResult && syncResult.terminal && !syncResult.active) setActiveSession(null);
    else if (syncResult.active) setActiveSession(syncResult.active);
  }, [currentStation, setActiveSession, useMock]);

  useEffect(() => {
    const storedUser = getStoredItem<UserInfo>(STORAGE_KEYS.user);
    const storedSession = getStoredItem<ActiveSession>(STORAGE_KEYS.session);
    const storedRewards = getStoredItem<UserReward[]>(STORAGE_KEYS.rewards);
    const stationId = getStoredItem<string>(STORAGE_KEYS.stationId);

    if (storedUser) setUserState(storedUser);
    if (storedSession) setActiveSessionState(storedSession);
    if (storedRewards) setRewards(storedRewards);

    const init = async () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const qrStation = params.get('station') || params.get('stationId');
        if (qrStation) await loadStation(qrStation);
        else if (stationId && !useMock) await loadStation(stationId);
      }
      setIsHydrated(true);
    };
    void init();
  }, [loadStation, useMock]);

  useEffect(() => {
    if (!isHydrated || useMock) return;
    void syncActiveSession();
    const interval = setInterval(() => void syncActiveSession(), 30000);
    return () => clearInterval(interval);
  }, [isHydrated, syncActiveSession, useMock]);

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'active') return;
    const interval = setInterval(() => {
      setActiveSessionState((prev) => {
        if (!prev) return prev;
        const started = prev.startTime;
        const elapsed = Math.floor((Date.now() - started.getTime()) / 60000);
        const updated = {
          ...prev,
          elapsedMinutes: elapsed,
          currentCharge: calculateCharge(elapsed, prev.hourlyRate, prev.dailyCap),
          lastSyncTime: new Date(),
        };
        setStoredItem(STORAGE_KEYS.session, updated);
        return updated;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [activeSession?.status, activeSession?.id]);

  const startRental = useCallback(
    async (userInfo: UserInfo, options?: { paymentMethodId?: string }): Promise<{ success: boolean; error?: string; sessionId?: string }> => {
      if (!currentStation) return { success: false, error: 'No station selected. Scan the station QR code.' };
      if (activeSession) return { success: false, error: 'You already have an active rental. Please return it first.' };

      const result = await getPwaDataLayer().startRentalFromApi(currentStation, userInfo, options);
      if (!result.success || !result.session) {
        return { success: false, error: 'error' in result ? result.error : 'Failed to start rental' };
      }
      setUser(userInfo);
      setActiveSession(result.session);
      setStoredItem(STORAGE_KEYS.sessionId, result.session.id);
      return { success: true, sessionId: result.session.id };
    },
    [activeSession, currentStation, setUser, setActiveSession],
  );

  const completeRental = useCallback(async (): Promise<{ success: boolean; qualifiedForReward: boolean }> => {
    if (!activeSession) return { success: false, qualifiedForReward: false };

    const pushReward = (reward: UserReward) => {
      setRewards((prev) => {
        const updated = [...prev, reward];
        setStoredItem(STORAGE_KEYS.rewards, updated);
        return updated;
      });
    };

    if (!useMock) await syncActiveSession();
    const result = await getPwaDataLayer().completeRentalFromApi(activeSession, currentStation);
    setCompletedSession({ ...activeSession, status: 'completed' as RentalState });
    setActiveSession(null);
    if (result.reward) pushReward(result.reward);
    return { success: result.success, qualifiedForReward: result.qualifiedForReward };
  }, [activeSession, currentStation, setActiveSession, syncActiveSession, useMock]);

  const addReward = useCallback((reward: UserReward) => {
    setRewards((prev) => {
      const updated = [...prev, reward];
      setStoredItem(STORAGE_KEYS.rewards, updated);
      return updated;
    });
  }, []);

  const updateReward = useCallback((rewardId: string, updates: Partial<UserReward>) => {
    setRewards((prev) => {
      const updated = prev.map((r) => (r.id === rewardId ? { ...r, ...updates } : r));
      setStoredItem(STORAGE_KEYS.rewards, updated);
      return updated;
    });
  }, []);

  const cancelRental = useCallback(async () => {
    const sessionId = activeSession?.id ?? getStoredItem<string>(STORAGE_KEYS.sessionId);
    if (sessionId && !useMock) {
      await getPwaDataLayer().cancelRentalFromApi(sessionId);
    }
    setActiveSession(null);
    setCompletedSession(null);
  }, [activeSession, useMock, setActiveSession]);

  const redeemReward = useCallback(
    async (rewardId: string, rewardCode?: string): Promise<{ success: boolean }> => {
      if (!useMock) {
        const code = rewardCode ?? rewards.find((r) => r.id === rewardId)?.code;
        if (!code) return { success: false };
        const result = await getPwaDataLayer().redeemRewardFromApi(rewardId, code);
        if (!result.success) return { success: false };
      }
      updateReward(rewardId, {
        status: 'redeemed',
        redeemedAt: new Date(),
      });
      return { success: true };
    },
    [updateReward, useMock, rewards],
  );

  const clearAllState = useCallback(() => {
    setUserState(null);
    setActiveSessionState(null);
    setCompletedSession(null);
    setRewards([]);
    Object.values(STORAGE_KEYS).forEach(removeStoredItem);
  }, []);

  if (!isHydrated) return null;

  return (
    <AppStateContext.Provider
      value={{
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
        startRental,
        syncActiveSession,
        completeRental,
        cancelRental,
        redeemReward,
        clearAllState,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used within AppStateProvider');
  return context;
}
