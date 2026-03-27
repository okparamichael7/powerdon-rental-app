// Custom hooks for consuming services with React state management
// These hooks abstract service calls and provide loading/error states

import { useState, useCallback, useEffect } from 'react';
import { 
  stationService,
  rentalService,
  rewardService,
  campaignService,
  supportService,
  analyticsService,
  userService,
} from '@/lib/services';
import type { Station, Campaign, RentalSession, User, Reward, DashboardStats } from '@/lib/types';
import type { ApiResponse, SupportTicket } from '@/lib/api/types';
import { isSuccessResponse, getErrorMessage } from '@/lib/api/client';

// Generic async state hook
interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useAsyncState<T>(initialData: T | null = null): AsyncState<T> & {
  setData: (data: T | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
} {
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setData(initialData);
    setLoading(false);
    setError(null);
  }, [initialData]);

  return { data, loading, error, setData, setLoading, setError, reset };
}

// ============================================================
// STATION HOOKS
// ============================================================

export function useStations() {
  const state = useAsyncState<Station[]>([]);

  const fetchStations = useCallback(async (filters?: Parameters<typeof stationService.getStations>[0]) => {
    state.setLoading(true);
    state.setError(null);
    try {
      const response = await stationService.getStations(filters);
      if (isSuccessResponse(response)) {
        state.setData(response.data);
      } else {
        state.setError(getErrorMessage(response));
      }
    } catch (err) {
      state.setError('Failed to fetch stations');
    } finally {
      state.setLoading(false);
    }
  }, []);

  return { ...state, fetchStations, refetch: fetchStations };
}

export function useStation(stationId: string) {
  const state = useAsyncState<Station>(null);

  const fetchStation = useCallback(async () => {
    if (!stationId) return;
    state.setLoading(true);
    state.setError(null);
    try {
      const response = await stationService.getStationById(stationId);
      if (isSuccessResponse(response)) {
        state.setData(response.data);
      } else {
        state.setError(getErrorMessage(response));
      }
    } catch (err) {
      state.setError('Failed to fetch station');
    } finally {
      state.setLoading(false);
    }
  }, [stationId]);

  useEffect(() => {
    fetchStation();
  }, [fetchStation]);

  return { ...state, refetch: fetchStation };
}

export function useStationAvailability(stationId: string) {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [availableSlots, setAvailableSlots] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAvailability = useCallback(async () => {
    if (!stationId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await stationService.checkAvailability({ stationId });
      if (isSuccessResponse(response)) {
        setIsAvailable(response.data.isAvailable);
        setAvailableSlots(response.data.availableSlots);
      } else {
        setError(getErrorMessage(response));
        setIsAvailable(false);
      }
    } catch (err) {
      setError('Failed to check availability');
      setIsAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  return { isAvailable, availableSlots, loading, error, refetch: checkAvailability };
}

// ============================================================
// RENTAL HOOKS
// ============================================================

export function useSessions() {
  const state = useAsyncState<RentalSession[]>([]);
  const [total, setTotal] = useState(0);

  const fetchSessions = useCallback(async (filters?: Parameters<typeof rentalService.getSessions>[0]) => {
    state.setLoading(true);
    state.setError(null);
    try {
      const response = await rentalService.getSessions(filters);
      if (isSuccessResponse(response)) {
        state.setData(response.data);
        setTotal(response.meta?.total || response.data.length);
      } else {
        state.setError(getErrorMessage(response));
      }
    } catch (err) {
      state.setError('Failed to fetch sessions');
    } finally {
      state.setLoading(false);
    }
  }, []);

  return { ...state, total, fetchSessions, refetch: fetchSessions };
}

export function useSession(sessionId: string) {
  const state = useAsyncState<RentalSession>(null);

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    state.setLoading(true);
    state.setError(null);
    try {
      const response = await rentalService.getSessionById(sessionId);
      if (isSuccessResponse(response)) {
        state.setData(response.data);
      } else {
        state.setError(getErrorMessage(response));
      }
    } catch (err) {
      state.setError('Failed to fetch session');
    } finally {
      state.setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return { ...state, refetch: fetchSession };
}

export function useActiveSession(userEmail: string) {
  const state = useAsyncState<RentalSession | null>(null);

  const checkActiveSession = useCallback(async () => {
    if (!userEmail) return;
    state.setLoading(true);
    state.setError(null);
    try {
      const response = await rentalService.getActiveSessionByUser(userEmail);
      if (isSuccessResponse(response)) {
        state.setData(response.data);
      } else {
        state.setError(getErrorMessage(response));
      }
    } catch (err) {
      state.setError('Failed to check active session');
    } finally {
      state.setLoading(false);
    }
  }, [userEmail]);

  return { ...state, checkActiveSession, refetch: checkActiveSession };
}

export function useStartRental() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startRental = useCallback(async (request: Parameters<typeof rentalService.startRental>[0]) => {
    setLoading(true);
    setError(null);
    try {
      const response = await rentalService.startRental(request);
      if (isSuccessResponse(response)) {
        return { success: true, data: response.data };
      } else {
        setError(getErrorMessage(response));
        return { success: false, error: response.error };
      }
    } catch (err) {
      const message = 'Failed to start rental';
      setError(message);
      return { success: false, error: { code: 'UNKNOWN', message } };
    } finally {
      setLoading(false);
    }
  }, []);

  return { startRental, loading, error };
}

export function useUnlockPowerBank() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlock = useCallback(async (sessionId: string, unlockToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await rentalService.unlockPowerBank({ sessionId, unlockToken });
      if (isSuccessResponse(response)) {
        return { success: true, data: response.data };
      } else {
        setError(getErrorMessage(response));
        return { success: false, error: response.error };
      }
    } catch (err) {
      const message = 'Failed to unlock power bank';
      setError(message);
      return { success: false, error: { code: 'UNKNOWN', message } };
    } finally {
      setLoading(false);
    }
  }, []);

  return { unlock, loading, error };
}

export function useReturnPowerBank() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnPowerBank = useCallback(async (request: Parameters<typeof rentalService.returnPowerBank>[0]) => {
    setLoading(true);
    setError(null);
    try {
      const response = await rentalService.returnPowerBank(request);
      if (isSuccessResponse(response)) {
        return { success: true, data: response.data };
      } else {
        setError(getErrorMessage(response));
        return { success: false, error: response.error };
      }
    } catch (err) {
      const message = 'Failed to return power bank';
      setError(message);
      return { success: false, error: { code: 'UNKNOWN', message } };
    } finally {
      setLoading(false);
    }
  }, []);

  return { returnPowerBank, loading, error };
}

// ============================================================
// REWARD HOOKS
// ============================================================

export function useRewards() {
  const state = useAsyncState<Reward[]>([]);

  const fetchRewards = useCallback(async (filters?: Parameters<typeof rewardService.getRewards>[0]) => {
    state.setLoading(true);
    state.setError(null);
    try {
      const response = await rewardService.getRewards(filters);
      if (isSuccessResponse(response)) {
        state.setData(response.data);
      } else {
        state.setError(getErrorMessage(response));
      }
    } catch (err) {
      state.setError('Failed to fetch rewards');
    } finally {
      state.setLoading(false);
    }
  }, []);

  return { ...state, fetchRewards, refetch: fetchRewards };
}

export function useUserRewards(userEmail: string) {
  const state = useAsyncState<Reward[]>([]);

  const fetchUserRewards = useCallback(async () => {
    if (!userEmail) return;
    state.setLoading(true);
    state.setError(null);
    try {
      const response = await rewardService.getRewardsByUser(userEmail);
      if (isSuccessResponse(response)) {
        state.setData(response.data);
      } else {
        state.setError(getErrorMessage(response));
      }
    } catch (err) {
      state.setError('Failed to fetch rewards');
    } finally {
      state.setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    fetchUserRewards();
  }, [fetchUserRewards]);

  return { ...state, refetch: fetchUserRewards };
}

// ============================================================
// CAMPAIGN HOOKS
// ============================================================

export function useCampaigns() {
  const state = useAsyncState<Campaign[]>([]);

  const fetchCampaigns = useCallback(async (filters?: Parameters<typeof campaignService.getCampaigns>[0]) => {
    state.setLoading(true);
    state.setError(null);
    try {
      const response = await campaignService.getCampaigns(filters);
      if (isSuccessResponse(response)) {
        state.setData(response.data);
      } else {
        state.setError(getErrorMessage(response));
      }
    } catch (err) {
      state.setError('Failed to fetch campaigns');
    } finally {
      state.setLoading(false);
    }
  }, []);

  return { ...state, fetchCampaigns, refetch: fetchCampaigns };
}

export function useActiveCampaigns() {
  const state = useAsyncState<Campaign[]>([]);

  const fetchActiveCampaigns = useCallback(async () => {
    state.setLoading(true);
    state.setError(null);
    try {
      const response = await campaignService.getActiveCampaigns();
      if (isSuccessResponse(response)) {
        state.setData(response.data);
      } else {
        state.setError(getErrorMessage(response));
      }
    } catch (err) {
      state.setError('Failed to fetch active campaigns');
    } finally {
      state.setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveCampaigns();
  }, [fetchActiveCampaigns]);

  return { ...state, refetch: fetchActiveCampaigns };
}

export function useCreateCampaign() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCampaign = useCallback(async (request: Parameters<typeof campaignService.createCampaign>[0]) => {
    setLoading(true);
    setError(null);
    try {
      const response = await campaignService.createCampaign(request);
      if (isSuccessResponse(response)) {
        return response.data;
      } else {
        setError(getErrorMessage(response));
        return null;
      }
    } catch (err) {
      setError('Failed to create campaign');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createCampaign, loading, error };
}

export function useUpdateCampaign() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateCampaign = useCallback(async (
    id: string, 
    request: Parameters<typeof campaignService.updateCampaign>[1]
  ) => {
    setLoading(true);
    setError(null);
    try {
      const response = await campaignService.updateCampaign(id, request);
      if (isSuccessResponse(response)) {
        return response.data;
      } else {
        setError(getErrorMessage(response));
        return null;
      }
    } catch (err) {
      setError('Failed to update campaign');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateCampaign, loading, error };
}

// ============================================================
// SUPPORT HOOKS
// ============================================================

export function useSupportTickets() {
  const state = useAsyncState<SupportTicket[]>([]);

  const fetchTickets = useCallback(async (filters?: Parameters<typeof supportService.getTickets>[0]) => {
    state.setLoading(true);
    state.setError(null);
    try {
      const response = await supportService.getTickets(filters);
      if (isSuccessResponse(response)) {
        state.setData(response.data);
      } else {
        state.setError(getErrorMessage(response));
      }
    } catch (err) {
      state.setError('Failed to fetch support tickets');
    } finally {
      state.setLoading(false);
    }
  }, []);

  return { ...state, fetchTickets, refetch: fetchTickets };
}

export function useCreateSupportTicket() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTicket = useCallback(async (request: Parameters<typeof supportService.createTicket>[0]) => {
    setLoading(true);
    setError(null);
    try {
      const response = await supportService.createTicket(request);
      if (isSuccessResponse(response)) {
        return { success: true, data: response.data };
      } else {
        setError(getErrorMessage(response));
        return { success: false, error: response.error };
      }
    } catch (err) {
      const message = 'Failed to create support ticket';
      setError(message);
      return { success: false, error: { code: 'UNKNOWN', message } };
    } finally {
      setLoading(false);
    }
  }, []);

  return { createTicket, loading, error };
}

// ============================================================
// ANALYTICS HOOKS
// ============================================================

export function useDashboardStats() {
  const state = useAsyncState<DashboardStats>(null);

  const fetchStats = useCallback(async () => {
    state.setLoading(true);
    state.setError(null);
    try {
      const response = await analyticsService.getDashboardStats();
      if (isSuccessResponse(response)) {
        state.setData(response.data);
      } else {
        state.setError(getErrorMessage(response));
      }
    } catch (err) {
      state.setError('Failed to fetch dashboard stats');
    } finally {
      state.setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { ...state, refetch: fetchStats };
}

// ============================================================
// USER HOOKS
// ============================================================

export function useUsers() {
  const state = useAsyncState<User[]>([]);

  const fetchUsers = useCallback(async (filters?: Parameters<typeof userService.getUsers>[0]) => {
    state.setLoading(true);
    state.setError(null);
    try {
      const response = await userService.getUsers(filters);
      if (isSuccessResponse(response)) {
        state.setData(response.data);
      } else {
        state.setError(getErrorMessage(response));
      }
    } catch (err) {
      state.setError('Failed to fetch users');
    } finally {
      state.setLoading(false);
    }
  }, []);

  return { ...state, fetchUsers, refetch: fetchUsers };
}

export function useCreateUser() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createUser = useCallback(async (request: Parameters<typeof userService.createUser>[0]) => {
    setLoading(true);
    setError(null);
    try {
      const response = await userService.createUser(request);
      if (isSuccessResponse(response)) {
        return { success: true, data: response.data };
      } else {
        setError(getErrorMessage(response));
        return { success: false, error: response.error };
      }
    } catch (err) {
      const message = 'Failed to create user';
      setError(message);
      return { success: false, error: { code: 'UNKNOWN', message } };
    } finally {
      setLoading(false);
    }
  }, []);

  return { createUser, loading, error };
}
