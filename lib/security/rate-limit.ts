/**
 * Rate Limiting Middleware — distributed when Upstash is configured.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/observability/logger'
import { incrementRateLimit } from '@/lib/security/rate-limit-store'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyPrefix?: string
  handler?: (request: NextRequest) => NextResponse
}

export const RATE_LIMITS = {
  api: { windowMs: 60_000, maxRequests: 100, keyPrefix: 'api' },
  stationMessage: { windowMs: 1000, maxRequests: 50, keyPrefix: 'station' },
  rentalStart: { windowMs: 60_000, maxRequests: 5, keyPrefix: 'rental' },
  auth: { windowMs: 15 * 60_000, maxRequests: 10, keyPrefix: 'auth' },
  admin: { windowMs: 60_000, maxRequests: 200, keyPrefix: 'admin' },
  webhook: { windowMs: 60_000, maxRequests: 120, keyPrefix: 'webhook' },
  health: { windowMs: 60_000, maxRequests: 60, keyPrefix: 'health' },
}

function getClientId(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  return forwardedFor?.split(',')[0]?.trim() || realIp || cfConnectingIp || 'unknown'
}

export function rateLimit(config: RateLimitConfig) {
  return async function rateLimitMiddleware(
    request: NextRequest,
    customKey?: string,
  ): Promise<{ allowed: boolean; response?: NextResponse }> {
    const clientId = customKey || getClientId(request)
    const key = `${config.keyPrefix || 'default'}:${clientId}`

    const result = await incrementRateLimit(key, config.windowMs, config.maxRequests)

    if (!result.allowed) {
      logger.warn('Rate limit exceeded', {
        clientId,
        key,
        resetTime: new Date(result.resetTime).toISOString(),
      })

      const response =
        config.handler?.(request) ||
        NextResponse.json(
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
          },
        )

      return { allowed: false, response }
    }

    return { allowed: true }
  }
}

export function addRateLimitHeaders(
  response: NextResponse,
  limit: number,
  remaining: number,
  resetTime: number,
): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(limit))
  response.headers.set('X-RateLimit-Remaining', String(remaining))
  response.headers.set('X-RateLimit-Reset', String(resetTime))
  return response
}

export const rateLimiters = {
  api: rateLimit(RATE_LIMITS.api),
  stationMessage: rateLimit(RATE_LIMITS.stationMessage),
  rentalStart: rateLimit(RATE_LIMITS.rentalStart),
  auth: rateLimit(RATE_LIMITS.auth),
  admin: rateLimit(RATE_LIMITS.admin),
  webhook: rateLimit(RATE_LIMITS.webhook),
  health: rateLimit(RATE_LIMITS.health),
}
