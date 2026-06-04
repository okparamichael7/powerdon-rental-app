import { NextRequest, NextResponse } from 'next/server'
import { rateLimiters, RATE_LIMITS } from '@/lib/security/rate-limit'
import { authenticate, type AuthContext } from '@/lib/security/auth'

export type RateLimitKey = keyof typeof rateLimiters

export async function enforceRateLimit(
  request: NextRequest,
  key: RateLimitKey = 'api',
): Promise<NextResponse | null> {
  const result = await rateLimiters[key](request)
  if (!result.allowed && result.response) {
    return result.response
  }
  return null
}

export async function requireAdminSession(request: NextRequest): Promise<
  | { ok: true; auth: AuthContext }
  | { ok: false; response: NextResponse }
> {
  const rateLimited = await enforceRateLimit(request, 'admin')
  if (rateLimited) return { ok: false, response: rateLimited }

  const auth = await authenticate(request)
  if (!auth) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 }),
    }
  }
  if (!auth.isAdmin && auth.role !== 'operator') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }),
    }
  }
  return { ok: true, auth }
}

/** Admin-only mutations (e.g. grant/revoke staff roles). Operators may read ops data but not manage staff. */
export async function requireAdminOnly(request: NextRequest): Promise<
  | { ok: true; auth: AuthContext }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth
  if (!auth.auth.isAdmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Admin role required', code: 'ADMIN_REQUIRED' },
        { status: 403 },
      ),
    }
  }
  return auth
}

export async function requireServiceOrAdmin(request: NextRequest): Promise<
  | { ok: true; auth: AuthContext }
  | { ok: false; response: NextResponse }
> {
  const rateLimited = await enforceRateLimit(request, 'stationMessage')
  if (rateLimited) return { ok: false, response: rateLimited }

  const auth = await authenticate(request)
  if (auth?.isService || auth?.isAdmin || auth?.role === 'operator') {
    return { ok: true, auth }
  }

  const authHeader = request.headers.get('authorization')
  const expectedToken = process.env.STATION_PROXY_TOKEN || process.env.TCP_PROXY_API_KEY

  if (expectedToken && authHeader === `Bearer ${expectedToken}`) {
    return {
      ok: true,
      auth: {
        userId: 'service:station-proxy',
        role: 'service',
        isAdmin: false,
        isService: true,
      },
    }
  }

  const allowInsecureDev = process.env.ALLOW_INSECURE_HARDWARE_DEV === 'true'
  if (process.env.NODE_ENV === 'development' && allowInsecureDev && !expectedToken) {
    return {
      ok: true,
      auth: {
        userId: 'service:dev',
        role: 'service',
        isAdmin: false,
        isService: true,
      },
    }
  }

  return {
    ok: false,
    response: NextResponse.json({ error: 'Forbidden', code: 'SERVICE_KEY_REQUIRED' }, { status: 403 }),
  }
}

export function parseSearchParams(request: NextRequest) {
  return request.nextUrl.searchParams
}
