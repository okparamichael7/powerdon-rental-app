/**
 * Health Check System
 * 
 * Features:
 * - Component health checks (database, Redis, external services)
 * - Aggregated health status
 * - Kubernetes-compatible endpoints (/health/live, /health/ready)
 */

import { createServiceClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/observability/logger';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  latency?: number;
  message?: string;
  lastCheck: Date;
}

export interface SystemHealth {
  status: HealthStatus;
  version: string;
  uptime: number;
  timestamp: Date;
  components: ComponentHealth[];
}

// Track application start time
const startTime = Date.now();

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<ComponentHealth> {
  const start = performance.now();
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('stations').select('id').limit(1);
    const latency = Math.round(performance.now() - start);
    
    if (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        latency,
        message: error.message,
        lastCheck: new Date(),
      };
    }
    
    return {
      name: 'database',
      status: latency > 1000 ? 'degraded' : 'healthy',
      latency,
      lastCheck: new Date(),
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      latency: Math.round(performance.now() - start),
      message: error instanceof Error ? error.message : 'Unknown error',
      lastCheck: new Date(),
    };
  }
}

/**
 * Check TCP proxy connectivity (if configured)
 */
async function checkTcpProxy(): Promise<ComponentHealth> {
  const proxyUrl = process.env.TCP_PROXY_URL;
  
  if (!proxyUrl) {
    return {
      name: 'tcp-proxy',
      status: 'healthy',
      message: 'Not configured',
      lastCheck: new Date(),
    };
  }
  
  const start = performance.now();
  try {
    const response = await fetch(`${proxyUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const latency = Math.round(performance.now() - start);
    
    if (!response.ok) {
      return {
        name: 'tcp-proxy',
        status: 'unhealthy',
        latency,
        message: `HTTP ${response.status}`,
        lastCheck: new Date(),
      };
    }
    
    return {
      name: 'tcp-proxy',
      status: latency > 500 ? 'degraded' : 'healthy',
      latency,
      lastCheck: new Date(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    const devHint =
      process.env.NODE_ENV === 'development'
        ? ' — start proxy: npm run tcp-proxy (or unset TCP_PROXY_URL for UI-only dev)'
        : '';
    // In development, unreachable proxy is degraded (optional process). In production, unhealthy.
    const status: HealthStatus =
      process.env.NODE_ENV === 'development' ? 'degraded' : 'unhealthy';

    return {
      name: 'tcp-proxy',
      status,
      latency: Math.round(performance.now() - start),
      message: `${message}${devHint}`,
      lastCheck: new Date(),
    };
  }
}

/**
 * Check external payment service (Stripe)
 */
async function checkPaymentService(): Promise<ComponentHealth> {
  // Simple check - just verify env var is set
  const hasStripeKey = !!process.env.STRIPE_SECRET_KEY;
  
  return {
    name: 'payment-service',
    status: hasStripeKey ? 'healthy' : 'degraded',
    message: hasStripeKey ? undefined : 'API key not configured',
    lastCheck: new Date(),
  };
}

/**
 * Get overall system health
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  // Run health checks in parallel
  const checks = await Promise.all([
    checkDatabase(),
    checkTcpProxy(),
    checkPaymentService(),
  ]);
  
  // Determine overall status
  const hasUnhealthy = checks.some(c => c.status === 'unhealthy');
  const hasDegraded = checks.some(c => c.status === 'degraded');
  
  const status: HealthStatus = hasUnhealthy ? 'unhealthy' :
                               hasDegraded ? 'degraded' : 'healthy';
  
  const health: SystemHealth = {
    status,
    version: process.env.APP_VERSION || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date(),
    components: checks,
  };
  
  // Log if unhealthy
  if (status === 'unhealthy') {
    logger.error('System health check failed', {
      status,
      unhealthyComponents: checks.filter(c => c.status === 'unhealthy').map(c => c.name),
    });
  }
  
  return health;
}

/**
 * Liveness check - is the service running?
 */
export function isLive(): boolean {
  // Basic check - if we can execute code, we're live
  return true;
}

/**
 * Readiness check - is the service ready to accept traffic?
 */
export async function isReady(): Promise<boolean> {
  try {
    const health = await getSystemHealth();
    // Ready if not completely unhealthy
    return health.status !== 'unhealthy';
  } catch {
    return false;
  }
}
