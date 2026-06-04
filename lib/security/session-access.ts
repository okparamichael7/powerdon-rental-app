import { NextRequest, NextResponse } from 'next/server'
import { authenticate, type AuthContext } from '@/lib/security/auth'
import type { DbRentalSession } from '@/lib/db/types'

export const SESSION_TOKEN_HEADER = 'x-session-token'

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

/** Public-safe session fields (no PII). */
export function toPublicSessionView(session: DbRentalSession, extras?: Record<string, unknown>) {
  return {
    id: session.id,
    sessionCode: session.session_code,
    status: session.status,
    pickupSlotNumber: session.pickup_slot_number,
    paymentStatus: session.payment_status,
    rewardQualified: session.reward_qualified,
    rewardStatus: session.reward_status,
    ...extras,
  }
}
