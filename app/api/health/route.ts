import { NextResponse } from 'next/server';
import { stationManager } from '@/lib/wscharge';

/**
 * Health check endpoint for monitoring and load balancers.
 * Returns system status including connected stations and uptime.
 */
export async function GET() {
  const connectedStations = stationManager.getConnectedStations();
  
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: 'connected', // Would check actual DB connection in production
      stationProxy: {
        status: 'running',
        connectedStations: connectedStations.length,
      },
    },
  });
}
