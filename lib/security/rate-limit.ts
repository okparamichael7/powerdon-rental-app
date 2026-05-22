/**
 * Rate Limiting Middleware
 * 
 * Features:
 * - In-memory rate limiting (use Redis in production for distributed)
 * - Configurable limits per route pattern
 * - IP-based and user-based limiting
 * - Sliding window algorithm
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/observability/logger';

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix?: string;    // Prefix for rate limit keys
  skipFailedRequests?: boolean;
  handler?: (request: NextRequest) => NextResponse;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

// Default rate limit configurations
export const RATE_LIMITS = {
  // General API endpoints
  api: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 100,
    keyPrefix: 'api',
  },
  
  // Station message endpoint (high volume)
  stationMessage: {
    windowMs: 1000,          // 1 second
    maxRequests: 50,         // 50 req/sec per station
    keyPrefix: 'station',
  },
  
  // Rental start (prevent abuse)
  rentalStart: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 5,          // 5 rental attempts per minute
    keyPrefix: 'rental',
  },
  
  // Auth endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,          // 10 attempts per 15 min
    keyPrefix: 'auth',
  },
  
  // Admin endpoints
  admin: {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 200,
    keyPrefix: 'admin',
  },
};

/**
 * Get client identifier for rate limiting
 */
function getClientId(request: NextRequest): string {
  // Try to get real IP from various headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  // Use the first IP from x-forwarded-for, or fall back to others
  const ip = forwardedFor?.split(',')[0]?.trim() || 
             realIp || 
             cfConnectingIp || 
             'unknown';
             
  return ip;
}

/**
 * Check rate limit and return result
 */
function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  
  if (!entry || entry.resetTime < now) {
    // Start a new window
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, newEntry);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: newEntry.resetTime,
    };
  }
  
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }
  
  entry.count += 1;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Rate limiter middleware factory
 */
export function rateLimit(config: RateLimitConfig) {
  return function rateLimitMiddleware(
    request: NextRequest,
    customKey?: string
  ): { allowed: boolean; response?: NextResponse } {
    const clientId = customKey || getClientId(request);
    const key = `${config.keyPrefix || 'default'}:${clientId}`;
    
    const result = checkRateLimit(key, config);
    
    if (!result.allowed) {
      logger.warn('Rate limit exceeded', {
        clientId,
        key,
        resetTime: new Date(result.resetTime).toISOString(),
      });
      
      const response = config.handler?.(request) || NextResponse.json(
        {
          error: 'Too many requests',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((result.resetTime - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(config.maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(result.resetTime),
          },
        }
      );
      
      return { allowed: false, response };
    }
    
    return { allowed: true };
  };
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  limit: number,
  remaining: number,
  resetTime: number
): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(limit));
  response.headers.set('X-RateLimit-Remaining', String(remaining));
  response.headers.set('X-RateLimit-Reset', String(resetTime));
  return response;
}

/**
 * Pre-configured rate limiters
 */
export const rateLimiters = {
  api: rateLimit(RATE_LIMITS.api),
  stationMessage: rateLimit(RATE_LIMITS.stationMessage),
  rentalStart: rateLimit(RATE_LIMITS.rentalStart),
  auth: rateLimit(RATE_LIMITS.auth),
  admin: rateLimit(RATE_LIMITS.admin),
};
