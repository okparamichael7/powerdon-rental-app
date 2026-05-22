// Real-time session updates hook using WebSocket
'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import useSWR from 'swr';

interface SessionEvent {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

interface UseSessionRealtimeOptions {
  sessionId: string;
  onUnlockResult?: (success: boolean, data: Record<string, unknown>) => void;
  onReturnDetected?: (data: Record<string, unknown>) => void;
  onSessionCompleted?: (data: Record<string, unknown>) => void;
  onError?: (error: Error) => void;
}

interface SessionData {
  success: boolean;
  session: {
    id: string;
    sessionCode: string;
    status: string;
    pickupStation: { id: string; name: string; location: string | null } | null;
    pickupSlotNumber: number;
    returnStation: { id: string; name: string; location: string | null } | null;
    returnSlotNumber: number | null;
    startedAt: string | null;
    endedAt: string | null;
    currentDurationMinutes: number;
    depositAmount: number;
    hourlyRate: number;
    dailyCap: number;
    currentCharge: number;
    amountCharged: number;
    amountRefunded: number;
    paymentStatus: string;
    rewardQualified: boolean;
    rewardStatus: string;
    rewardThresholdMinutes: number | null;
    reward: {
      id: string;
      code: string;
      type: string;
      value: number;
      description: string | null;
      status: string;
      expiresAt: string;
      redeemedAt: string | null;
    } | null;
    events: Array<{
      id: string;
      type: string;
      description: string;
      timestamp: string;
      metadata: Record<string, unknown>;
    }>;
  };
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useSessionRealtime({
  sessionId,
  onUnlockResult,
  onReturnDetected,
  onSessionCompleted,
  onError,
}: UseSessionRealtimeOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SessionEvent | null>(null);

  // Fetch session data with SWR
  const {
    data,
    error,
    mutate,
    isLoading,
  } = useSWR<SessionData>(
    sessionId ? `/api/rentals/${sessionId}` : null,
    fetcher,
    {
      refreshInterval: 5000, // Poll every 5 seconds as fallback
      revalidateOnFocus: true,
    }
  );

  // Handle WebSocket message
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: SessionEvent = JSON.parse(event.data);
      setLastEvent(message);

      // Check if this event is relevant to our session
      const eventStationId = message.data?.stationId;
      const sessionStationId = data?.session?.pickupStation?.id;

      // Handle different event types
      switch (message.event) {
        case 'unlock_result': {
          if (eventStationId === sessionStationId) {
            const success = message.data.success as boolean;
            onUnlockResult?.(success, message.data);
            // Refresh session data
            mutate();
          }
          break;
        }

        case 'return_detected': {
          // Check if the power bank matches our session
          const powerBankId = message.data.powerBankId;
          if (data?.session && powerBankId) {
            onReturnDetected?.(message.data);
            // Refresh session data
            mutate();
          }
          break;
        }

        case 'session_completed': {
          if (message.data.sessionId === sessionId) {
            onSessionCompleted?.(message.data);
            mutate();
          }
          break;
        }

        case 'station_disconnected': {
          if (eventStationId === sessionStationId) {
            onError?.(new Error('Station disconnected'));
          }
          break;
        }
      }
    } catch (err) {
      console.error('[WS] Failed to parse message:', err);
    }
  }, [sessionId, data, onUnlockResult, onReturnDetected, onSessionCompleted, onError, mutate]);

  // Connect to WebSocket
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8089/ws';
    
    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[WS] Connected');
          setIsConnected(true);
        };

        ws.onmessage = handleMessage;

        ws.onerror = (error) => {
          console.error('[WS] Error:', error);
          setIsConnected(false);
        };

        ws.onclose = () => {
          console.log('[WS] Disconnected');
          setIsConnected(false);
          
          // Reconnect after 3 seconds
          setTimeout(connect, 3000);
        };

        wsRef.current = ws;
      } catch (err) {
        console.error('[WS] Connection failed:', err);
        setIsConnected(false);
        
        // Retry connection
        setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [handleMessage]);

  // Manual refresh function
  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    session: data?.session || null,
    isLoading,
    error,
    isConnected,
    lastEvent,
    refresh,
  };
}

// Hook for admin/dashboard to monitor all stations
export function useStationEvents() {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [connectedStations, setConnectedStations] = useState<Array<{
    stationId: string;
    externalId: string;
    connectedAt: string;
  }>>([]);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8089/ws';
    
    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[WS Admin] Connected');
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const message: SessionEvent = JSON.parse(event.data);
            
            // Handle initial connected state
            if (message.event === 'connected') {
              const stations = message.data.stations as Array<{
                stationId: string;
                externalId: string;
                connectedAt: string;
              }>;
              setConnectedStations(stations || []);
            }
            
            // Handle station connection events
            if (message.event === 'station_connected') {
              const newStation = {
                stationId: message.data.stationId as string,
                externalId: message.data.externalId as string,
                connectedAt: message.timestamp,
              };
              setConnectedStations(prev => [...prev, newStation]);
            }
            
            if (message.event === 'station_disconnected') {
              const stationId = message.data.stationId as string;
              setConnectedStations(prev => prev.filter(s => s.stationId !== stationId));
            }
            
            // Add to events list (keep last 100)
            setEvents(prev => [message, ...prev].slice(0, 100));
          } catch (err) {
            console.error('[WS Admin] Failed to parse message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('[WS Admin] Error:', error);
          setIsConnected(false);
        };

        ws.onclose = () => {
          console.log('[WS Admin] Disconnected');
          setIsConnected(false);
          setTimeout(connect, 3000);
        };

        wsRef.current = ws;
      } catch (err) {
        console.error('[WS Admin] Connection failed:', err);
        setIsConnected(false);
        setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    isConnected,
    events,
    connectedStations,
    clearEvents,
  };
}
