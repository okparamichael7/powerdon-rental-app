import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit, type RateLimitKey } from '@/lib/api/route-helpers'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (request: NextRequest, context?: any) => Promise<NextResponse>

/**
 * Wraps public API handlers with consistent rate limiting.
 */
export function withPublicApi(
  handler: RouteHandler,
  rateLimitKey: RateLimitKey = 'api',
): RouteHandler {
  return async (request, context) => {
    const rateLimited = enforceRateLimit(request, rateLimitKey)
    if (rateLimited) return rateLimited
    return handler(request, context)
  }
}
