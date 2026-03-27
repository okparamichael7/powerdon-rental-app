'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  type ActiveSession,
  type UserReward,
  type StationInfo,
  type UserInfo,
  type RentalState,
  mockStation,
  createMockActiveSession,
  createMockReward,
  calculateCharge,
} from './session-store';

// App-level state that persists across tab navigation
interface AppState {
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

  // Rewards
  rewards: UserReward[];
  addReward: (reward: UserReward) => void;
  updateReward: (rewardId: string, updates: Partial<UserReward>) => void;

  // Actions
  startRental: (userInfo: UserInfo) => Promise<{ success: boolean; error?: string }>;
  completeRental: () => Promise<{ success: boolean; qualifiedForReward: boolean }>;
  cancelRental: () => void;
  redeemReward: (rewardId: string) => Promise<{ success: boolean }>;

  // Demo controls
  simulateActiveSession: () => void;
  clearAllState: () => void;
}

const AppStateContext = createContext<AppState | null>(null);

// Storage keys
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

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserInfo | null>(null);
  const [activeSession, setActiveSessionState] = useState<ActiveSession | null>(null);
  const [completedSession, setCompletedSession] = useState<ActiveSession | null>(null);
  const [currentStation, setCurrentStation] = useState<StationInfo | null>(mockStation);
  const [rewards, setRewards] = useState<UserReward[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const storedUser = getStoredItem<UserInfo>(STORAGE_KEYS.user);
    const storedSession = getStoredItem<ActiveSession>(STORAGE_KEYS.session);
    const storedRewards = getStoredItem<UserReward[]>(STORAGE_KEYS.rewards);

    if (storedUser) setUserState(storedUser);
    if (storedSession) setActiveSessionState(storedSession);
    if (storedRewards) setRewards(storedRewards);
    
    setIsHydrated(true);
  }, []);

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

  // Start rental flow
  const startRental = useCallback(async (userInfo: UserInfo): Promise<{ success: boolean; error?: string }> => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Check for existing active session
    if (activeSession) {
      return { success: false, error: 'You already have an active rental. Please return it first.' };
    }

    // Random failure simulation (10% chance)
    if (Math.random() < 0.1) {
      return { success: false, error: 'Payment authorization failed. Please try again.' };
    }

    // Create new session
    const newSession = createMockActiveSession();
    newSession.status = 'active';
    newSession.elapsedMinutes = 0;
    newSession.startTime = new Date();
    newSession.currentCharge = 0;

    setUser(userInfo);
    setActiveSession(newSession);

    return { success: true };
  }, [activeSession, setUser, setActiveSession]);

  // Complete rental (return power bank)
  const completeRental = useCallback(async (): Promise<{ success: boolean; qualifiedForReward: boolean }> => {
    if (!activeSession) {
      return { success: false, qualifiedForReward: false };
    }

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    const qualifiedForReward = activeSession.elapsedMinutes >= activeSession.rewardThreshold;

    // Store completed session for display
    setCompletedSession({
      ...activeSession,
      status: 'completed' as RentalState,
    });

    // Create reward if qualified
    if (qualifiedForReward) {
      const reward = createMockReward(activeSession.id);
      reward.actualMinutes = activeSession.elapsedMinutes;
      addReward(reward);
    }

    // Clear active session
    setActiveSession(null);

    return { success: true, qualifiedForReward };
  }, [activeSession, setActiveSession, addReward]);

  // Cancel rental
  const cancelRental = useCallback(() => {
    setActiveSession(null);
    setCompletedSession(null);
  }, [setActiveSession]);

  // Redeem reward
  const redeemReward = useCallback(async (rewardId: string): Promise<{ success: boolean }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    updateReward(rewardId, {
      status: 'redeemed',
      redeemedAt: new Date(),
      redemptionLocation: 'Merch Booth A',
    });

    return { success: true };
  }, [updateReward]);

  // Demo: simulate having an active session
  const simulateActiveSession = useCallback(() => {
    const session = createMockActiveSession();
    setActiveSession(session);
  }, [setActiveSession]);

  // Clear all state
  const clearAllState = useCallback(() => {
    setUserState(null);
    setActiveSessionState(null);
    setCompletedSession(null);
    setRewards([]);
    removeStoredItem(STORAGE_KEYS.user);
    removeStoredItem(STORAGE_KEYS.session);
    removeStoredItem(STORAGE_KEYS.rewards);
  }, []);

  // Update elapsed time for active session
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'active') return;

    const interval = setInterval(() => {
      setActiveSessionState(prev => {
        if (!prev) return prev;
        const newElapsed = prev.elapsedMinutes + 1;
        const updated = {
          ...prev,
          elapsedMinutes: newElapsed,
          currentCharge: calculateCharge(newElapsed, prev.hourlyRate, prev.dailyCap),
          lastSyncTime: new Date(),
        };
        setStoredItem(STORAGE_KEYS.session, updated);
        return updated;
      });
    }, 1000); // 1 second = 1 minute for demo

    return () => clearInterval(interval);
  }, [activeSession?.status]);

  // Don't render children until hydrated to avoid hydration mismatch
  if (!isHydrated) {
    return null;
  }

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
        rewards,
        addReward,
        updateReward,
        startRental,
        completeRental,
        cancelRental,
        redeemReward,
        simulateActiveSession,
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
