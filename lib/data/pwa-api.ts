import type { ActiveSession, StationInfo, UserInfo, UserReward } from '@/lib/session-store'

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
        campaignId: String(s.campaignId ?? ''),
        campaignName: String(s.campaignName ?? 'Event'),
        hourlyRate: Number(s.hourlyRate ?? 2),
        dailyCap: Number(s.dailyCap ?? 10),
        depositAmount: Number(s.depositAmount ?? 25),
        rewardThreshold: Number(s.rewardThresholdMinutes ?? 60),
        rewardDescription: String(s.rewardDescription ?? ''),
      },
    }
  } catch {
    return { success: false, error: 'Failed to load station' }
  }
}

export async function syncSessionFromApi(
  sessionId: string,
  station: StationInfo,
): Promise<{ active: ActiveSession | null; terminal?: boolean }> {
  try {
    const res = await fetch(`/api/rentals/${sessionId}`)
    const body = await res.json()
    if (!body.success || !body.session) {
      return { active: null, terminal: body.error === 'Session not found' }
    }
    if (['completed', 'cancelled', 'expired', 'failed'].includes(body.session.status)) {
      return { active: null, terminal: true }
    }
    const startedAt = body.session.startedAt ? new Date(String(body.session.startedAt)) : new Date()
    return {
      active: {
        id: String(body.session.id),
        sessionCode: String(body.session.sessionCode),
        stationId: station.id,
        stationName: station.name,
        slotNumber: Number(body.session.pickupSlotNumber ?? 0),
        startTime: startedAt,
        elapsedMinutes: Number(body.session.currentDurationMinutes ?? 0),
        hourlyRate: Number(body.session.hourlyRate ?? station.hourlyRate),
        dailyCap: Number(body.session.dailyCap ?? station.dailyCap),
        depositAmount: Number(body.session.depositAmount ?? station.depositAmount),
        currentCharge: Number(body.session.currentCharge ?? 0),
        rewardThreshold: Number(body.session.rewardThresholdMinutes ?? station.rewardThreshold),
        rewardDescription: station.rewardDescription,
        campaignId: station.campaignId,
        campaignName: station.campaignName,
        status: body.session.status === 'pending' ? 'unlocking' : 'active',
        lastSyncTime: new Date(),
      },
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
  const res = await fetch(`/api/rentals/${session.id}`)
  const body = await res.json()
  const qualified = Boolean(body.session?.rewardQualified)
  let reward: UserReward | undefined
  if (body.session?.reward) {
    reward = {
      id: body.session.reward.id,
      code: body.session.reward.code,
      sessionId: session.id,
      campaignId: station?.campaignId ?? '',
      campaignName: station?.campaignName ?? '',
      type: 'voucher',
      value: body.session.reward.value,
      description: body.session.reward.description ?? '',
      status: 'issued',
      issuedAt: new Date(),
      expiresAt: new Date(body.session.reward.expiresAt),
      qualificationMinutes: session.rewardThreshold,
      actualMinutes: session.elapsedMinutes,
    }
  }
  return { success: true, qualifiedForReward: qualified, reward }
}

export async function cancelRentalFromApi(sessionId: string): Promise<void> {
  await fetch(`/api/rentals/${sessionId}/cancel`, { method: 'POST' })
}

export async function redeemRewardFromApi(rewardId: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/rewards/${rewardId}/redeem`, { method: 'POST' })
  const body = await res.json()
  return { success: Boolean(body.success) }
}

export function sessionFromCheckoutApi(
  session: Record<string, unknown>,
  station: StationInfo,
): ActiveSession {
  const startedAt = session.startedAt ? new Date(String(session.startedAt)) : new Date()
  return {
    id: String(session.id),
    sessionCode: String(session.sessionCode),
    stationId: (session.pickupStation as { id?: string } | null)?.id ?? station.id,
    stationName: (session.pickupStation as { name?: string } | null)?.name ?? station.name,
    slotNumber: Number(session.pickupSlotNumber ?? 1),
    startTime: startedAt,
    elapsedMinutes: Number(session.currentDurationMinutes ?? 0),
    hourlyRate: Number(session.hourlyRate ?? station.hourlyRate),
    dailyCap: Number(session.dailyCap ?? station.dailyCap),
    depositAmount: Number(session.depositAmount ?? station.depositAmount),
    currentCharge: Number(session.currentCharge ?? 0),
    rewardThreshold: station.rewardThreshold,
    rewardDescription: station.rewardDescription,
    campaignId: station.campaignId,
    campaignName: station.campaignName,
    status: session.status === 'active' ? 'active' : 'unlocking',
    lastSyncTime: new Date(),
  }
}
