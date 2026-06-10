import { NextRequest, NextResponse } from 'next/server'
import { authenticate, type AuthContext } from '@/lib/security/auth'
import type { DbRentalSession } from '@/lib/db/types'

export const SESSION_TOKEN_HEADER = 'x-session-token'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SESSION_CODE_RE = /^[A-Z0-9]{8}$/

export function isSessionUuid(identifier: string): boolean {
  return UUID_RE.test(identifier)
}

export function isSessionCode(identifier: string): boolean {
  return SESSION_CODE_RE.test(identifier)
}

export function extractSessionToken(request: NextRequest): string | null {
  const header = request.headers.get(SESSION_TOKEN_HEADER)
  if (header?.trim()) return header.trim()
  const query = request.nextUrl.searchParams.get('token')
  return query?.trim() || null
}

export function isStaffAuth(auth: AuthContext | null): boolean {
  if (!auth) return false
  return auth.isAdmin || auth.role === 'operator' || auth.isService
}

export function verifyUnlockToken(
  session: Pick<DbRentalSession, 'unlock_token' | 'unlock_token_expires_at'>,
  token: string | null,
): boolean {
  if (!token || !session.unlock_token) return false
  if (token !== session.unlock_token) return false
  if (session.unlock_token_expires_at) {
    const expires = new Date(session.unlock_token_expires_at)
    if (expires.getTime() < Date.now()) return false
  }
  return true
}

export async function authorizeSessionAccess(
  request: NextRequest,
  session: DbRentalSession,
  tokenOverride?: string | null,
): Promise<{ authorized: true; auth: AuthContext | null } | { authorized: false; response: NextResponse }> {
  const auth = await authenticate(request)
  if (isStaffAuth(auth)) {
    return { authorized: true, auth }
  }

  const token = tokenOverride ?? extractSessionToken(request)
  if (verifyUnlockToken(session, token)) {
    return { authorized: true, auth: null }
  }

  return {
    authorized: false,
    response: NextResponse.json(
      { success: false, error: 'Valid session token required', code: 'SESSION_TOKEN_REQUIRED' },
      { status: 403 },
    ),
  }
}

/**
 * UUID lookups require a valid unlock token or staff auth.
 * Session codes may be used for status checks without revealing PII.
 */
export function denyUuidLookupWithoutAuth(
  lookupKey: string,
  authorized: boolean,
): NextResponse | null {
  if (authorized || !isSessionUuid(lookupKey)) return null
  return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 })
}

/** Public-safe session fields (no PII). */
export function toPublicSessionView(session: DbRentalSession, extras?: Record<string, unknown>) {
  return {
    id: session.id,
    sessionCode: session.session_code,
    status: session.status,
    pickupSlotNumber: session.pickup_slot_number,
    paymentStatus: session.payment_status,
    depositAmount: session.deposit_amount,
    hourlyRate: session.hourly_rate,
    dailyCap: session.daily_cap,
    startedAt: session.started_at,
    rewardQualified: session.reward_qualified,
    rewardStatus: session.reward_status,
    ...extras,
  }
}
