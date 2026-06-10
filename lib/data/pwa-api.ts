import type { ActiveSession, StationInfo, UserInfo, UserReward } from '@/lib/session-store'
import { saveSessionToken, rentalSessionAuthHeaders } from '@/lib/client/session-token'

export type SessionSyncResult = {
  active: ActiveSession | null
  terminal?: boolean
  notFound?: boolean
}

export async function fetchRentalSessionByCode(
  sessionCode: string,
): Promise<{ success: boolean; session?: Record<string, unknown>; error?: string }> {
  const normalizedCode = sessionCode.trim().toUpperCase()
  try {
    const res = await fetch(`/api/rentals/${encodeURIComponent(normalizedCode)}`)
    const body = await res.json()
    if (!res.ok || !body.success || !body.session) {
      return { success: false, error: body.error || 'Session not found' }
    }
    return { success: true, session: body.session as Record<string, unknown> }
  } catch {
    return { success: false, error: 'Network error' }
  }
}

/** Wait for checkout borrow dispatch + cabinet pickup to mark the session active. */
export async function pollRentalSessionAfterCheckout(
  sessionCode: string,
  options?: { maxAttempts?: number; intervalMs?: number },
): Promise<Record<string, unknown> | null> {
  const maxAttempts = options?.maxAttempts ?? 20
  const intervalMs = options?.intervalMs ?? 1000

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await fetchRentalSessionByCode(sessionCode)
    if (result.success && result.session) {
      const status = String(result.session.status ?? 'pending')
      if (status === 'active' || status === 'failed') {
        return result.session
      }
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }
  return null
}

export async function loadStationFromApi(stationId: string): Promise<{ success: boolean; station?: StationInfo; error?: string }> {
  try {
    const res = await fetch(`/api/stations/${stationId}?source=database`)
    const body = await res.json()
    if (!body.success || !body.data) {
      return { success: false, error: body.error || 'Station not found' }
    }
    const s = body.data
    return {
      success: true,
      station: {
        id: String(s.id),
        name: String(s.name),
        location: String(s.location ?? ''),
        status: s.isOnline ? 'online' : 'offline',
        availableSlots: Number(s.availableSlots ?? 0),
        totalSlots: Number(s.totalSlots ?? 12),
        campaignId: s.campaignId ? String(s.campaignId) : undefined,
        campaignName: String(s.campaignName ?? 'Event'),
        hourlyRate: Number(s.hourlyRate ?? 2),
        dailyCap: Number(s.dailyCap ?? 10),
        depositAmount: Number(s.depositAmount ?? 25),
        rewardThreshold: Number(s.rewardThresholdMinutes ?? 60),
        rewardDescription: String(s.rewardDescription ?? ''),
        rewardValue: Number(s.rewardValue ?? 0),
      },
    }
  } catch {
    return { success: false, error: 'Failed to load station' }
  }
}

const TERMINAL_RENTAL_STATUSES = new Set(['completed', 'cancelled', 'expired'])

function mapApiSessionToActive(
  session: Record<string, unknown>,
  station: StationInfo,
): ActiveSession {
  const dbStatus = String(session.status ?? 'pending')
  const startedAt = session.startedAt ? new Date(String(session.startedAt)) : new Date()
  let uiStatus: ActiveSession['status'] = 'active'
  if (dbStatus === 'pending') uiStatus = 'unlocking'
  else if (dbStatus === 'failed') uiStatus = 'failed'

  return {
    id: String(session.id),
    sessionCode: String(session.sessionCode),
    stationId: station.id,
    stationName: station.name,
    slotNumber: Number(session.pickupSlotNumber ?? 0),
    startTime: startedAt,
    elapsedMinutes: Number(session.currentDurationMinutes ?? 0),
    hourlyRate: Number(session.hourlyRate ?? station.hourlyRate),
    dailyCap: Number(session.dailyCap ?? station.dailyCap),
    depositAmount: Number(session.depositAmount ?? station.depositAmount),
    currentCharge: Number(session.currentCharge ?? 0),
    rewardThreshold: Number(session.rewardThresholdMinutes ?? station.rewardThreshold),
    rewardDescription: station.rewardDescription,
    rewardValue: station.rewardValue,
    campaignId: station.campaignId,
    campaignName: station.campaignName,
    status: uiStatus,
    lastSyncTime: new Date(),
  }
}

export async function syncSessionFromApi(
  sessionId: string,
  station: StationInfo,
  sessionCode?: string,
): Promise<SessionSyncResult> {
  try {
    const lookupKey = (sessionCode?.trim().toUpperCase() || sessionId).trim()
    const res = await fetch(`/api/rentals/${encodeURIComponent(lookupKey)}`, {
      headers: rentalSessionAuthHeaders(sessionId, sessionCode),
    })
    const body = await res.json()
    if (!body.success || !body.session) {
      return {
        active: null,
        terminal: false,
        notFound: res.status === 404 || body.error === 'Session not found',
      }
    }
    const dbStatus = String(body.session.status)
    if (TERMINAL_RENTAL_STATUSES.has(dbStatus)) {
      return { active: null, terminal: true }
    }
    return {
      active: mapApiSessionToActive(body.session as Record<string, unknown>, station),
    }
  } catch {
    return { active: null }
  }
}

export async function startRentalFromApi(
  station: StationInfo,
  userInfo: UserInfo,
  options?: { paymentMethodId?: string },
): Promise<{ success: boolean; error?: string; session?: ActiveSession }> {
  try {
    const res = await fetch('/api/rentals/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stationId: station.id,
        userEmail: userInfo.email,
        userName: userInfo.name,
        marketingConsent: userInfo.marketingConsent,
        campaignId: station.campaignId || undefined,
        paymentMethodId: options?.paymentMethodId,
      }),
    })
    const body = await res.json()
    if (!res.ok || !body.success) {
      return { success: false, error: body.error || 'Failed to start rental' }
    }
    if (body.session.unlockToken && body.session.id) {
      saveSessionToken(body.session.id, body.session.unlockToken, body.session.sessionCode)
    }

    const session: ActiveSession = {
      id: body.session.id,
      sessionCode: body.session.sessionCode,
      stationId: station.id,
      stationName: body.session.stationName || station.name,
      slotNumber: body.session.slotNumber,
      startTime: new Date(),
      elapsedMinutes: 0,
      hourlyRate: body.session.hourlyRate ?? station.hourlyRate,
      dailyCap: body.session.dailyCap ?? station.dailyCap,
      depositAmount: body.session.depositAmount ?? station.depositAmount,
      currentCharge: 0,
      rewardThreshold: station.rewardThreshold,
      rewardDescription: station.rewardDescription,
      rewardValue: station.rewardValue,
      campaignId: station.campaignId,
      campaignName: station.campaignName,
      status: body.hardwareCommandSent ? 'active' : 'unlocking',
      lastSyncTime: new Date(),
    }
    return { success: true, session }
  } catch {
    return { success: false, error: 'Network error. Please try again.' }
  }
}

export async function completeRentalFromApi(
  session: ActiveSession,
  station: StationInfo | null,
): Promise<{ success: boolean; qualifiedForReward: boolean; reward?: UserReward }> {
  const lookupKey = session.sessionCode || session.id
  const res = await fetch(`/api/rentals/${encodeURIComponent(lookupKey)}`, {
    headers: rentalSessionAuthHeaders(session.id, session.sessionCode),
  })
  const body = await res.json()
  if (!res.ok || !body.success || !body.session) {
    return { success: false, qualifiedForReward: false }
  }
  const qualified = Boolean(body.session.rewardQualified)
  const actualMinutes = Number(
    body.session.currentDurationMinutes ?? session.elapsedMinutes,
  )
  let reward: UserReward | undefined
  if (body.session.reward) {
    reward = {
      id: body.session.reward.id,
      code: body.session.reward.code,
      sessionId: session.id,
      campaignId: station?.campaignId ?? '',
      campaignName: station?.campaignName ?? '',
      type: 'voucher',
      value: body.session.reward.value,
      description: body.session.reward.description ?? '',
      status: body.session.reward.status === 'redeemed' ? 'redeemed' : 'issued',
      issuedAt: new Date(),
      expiresAt: new Date(body.session.reward.expiresAt),
      qualificationMinutes: session.rewardThreshold,
      actualMinutes,
    }
  }
  return { success: true, qualifiedForReward: qualified, reward }
}

export async function cancelRentalFromApi(
  sessionId: string,
  sessionCode?: string,
): Promise<void> {
  await fetch(`/api/rentals/${sessionId}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...rentalSessionAuthHeaders(sessionId, sessionCode),
    },
  })
}

export async function redeemRewardFromApi(
  rewardId: string,
  code: string,
): Promise<{ success: boolean }> {
  const res = await fetch(`/api/rewards/${rewardId}/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  const body = await res.json()
  return { success: Boolean(body.success) }
}

export type PublicSessionLookup = {
  sessionCode: string
  status: string
  pickupSlotNumber?: number
  currentDurationMinutes?: number
  currentCharge?: number
  rewardQualified?: boolean
}

export async function lookupSessionByCode(
  code: string,
): Promise<{ success: boolean; session?: PublicSessionLookup; error?: string }> {
  try {
    const normalized = code.trim().toUpperCase()
    const res = await fetch(`/api/rentals/${encodeURIComponent(normalized)}`)
    const body = await res.json()
    if (!res.ok || !body.success || !body.session) {
      return { success: false, error: body.error || 'Session not found' }
    }
    return {
      success: true,
      session: {
        sessionCode: String(body.session.sessionCode),
        status: String(body.session.status),
        pickupSlotNumber: body.session.pickupSlotNumber,
        currentDurationMinutes: body.session.currentDurationMinutes,
        currentCharge: body.session.currentCharge,
        rewardQualified: body.session.rewardQualified,
      },
    }
  } catch {
    return { success: false, error: 'Network error' }
  }
}

export async function waitForSessionCompletion(
  sessionId: string,
  options?: { intervalMs?: number; maxAttempts?: number; sessionCode?: string },
): Promise<{ completed: boolean; timedOut?: boolean }> {
  const intervalMs = options?.intervalMs ?? 3000
  const maxAttempts = options?.maxAttempts ?? 100
  const sessionCode = options?.sessionCode
  const lookupKey = sessionCode ?? sessionId

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(`/api/rentals/${encodeURIComponent(lookupKey)}`, {
        headers: rentalSessionAuthHeaders(sessionId, sessionCode),
      })
      const body = await res.json()
      if (body.success && body.session) {
        const status = String(body.session.status)
        if (['completed', 'cancelled', 'expired', 'failed'].includes(status)) {
          return { completed: status === 'completed' }
        }
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return { completed: false, timedOut: true }
}

export async function submitSupportTicket(input: {
  email: string
  subject: string
  description: string
  category:
    | 'rental_issue'
    | 'payment_issue'
    | 'return_issue'
    | 'reward_issue'
    | 'station_issue'
    | 'account_issue'
    | 'other'
  sessionId?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
}): Promise<{ success: boolean; ticketNumber?: string; error?: string }> {
  try {
    const res = await fetch('/api/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: input.email,
        subject: input.subject,
        description: input.description,
        category: input.category,
        sessionId: input.sessionId,
        priority: input.priority ?? 'medium',
        website: '',
      }),
    })
    const body = await res.json()
    if (!res.ok || !body.success) {
      return { success: false, error: body.error || 'Failed to submit ticket' }
    }
    return { success: true, ticketNumber: body.data?.ticketNumber }
  } catch {
    return { success: false, error: 'Network error' }
  }
}

export function sessionFromCheckoutApi(
  session: Record<string, unknown>,
  station: StationInfo,
): ActiveSession {
  return mapApiSessionToActive(
    {
      ...session,
      pickupSlotNumber: session.pickupSlotNumber ?? 1,
    },
    station,
  )
}
