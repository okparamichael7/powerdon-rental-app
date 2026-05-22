import { NextResponse } from 'next/server';
import { getSystemHealth, isLive, isReady } from '@/lib/ops/health';
import { stationManager } from '@/lib/wscharge';

/**
 * GET /api/health
 * 
 * Comprehensive health check endpoint for monitoring.
 * Returns detailed system status including all components.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  
  // Kubernetes liveness probe
  if (type === 'live') {
    return NextResponse.json(
      { status: isLive() ? 'ok' : 'error' },
      { status: isLive() ? 200 : 503 }
    );
  }
  
  // Kubernetes readiness probe
  if (type === 'ready') {
    const ready = await isReady();
    return NextResponse.json(
      { status: ready ? 'ok' : 'error' },
      { status: ready ? 200 : 503 }
    );
  }
  
  // Full health check
  const health = await getSystemHealth();
  const connectedStations = stationManager.getConnectedStations();
  
  const statusCode = health.status === 'healthy' ? 200 :
                     health.status === 'degraded' ? 200 : 503;
  
  return NextResponse.json({
    ...health,
    services: {
      stationProxy: {
        status: 'running',
        connectedStations: connectedStations.length,
        stations: connectedStations.map(s => ({
          deviceId: s.deviceId,
          status: s.status,
          lastHeartbeat: s.lastHeartbeat,
        })),
      },
    },
  }, { status: statusCode });
}
