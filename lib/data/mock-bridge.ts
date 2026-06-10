import {
  mockStation,
  createMockActiveSession,
  createMockReward,
  type ActiveSession,
  type StationInfo,
  type UserInfo,
  type UserReward,
} from '@/lib/session-store'

export async function loadStationFromApi(stationId: string) {
  void stationId
  return { success: true as const, station: mockStation }
}

export async function syncSessionFromApi(_sessionId: string, station: StationInfo) {
  const session = createMockActiveSession()
  session.stationId = station.id
  session.stationName = station.name
  return { active: session, terminal: false as boolean | undefined }
}

export async function startRentalFromApi(_station: StationInfo, userInfo: UserInfo) {
  await new Promise((r) => setTimeout(r, 800))
  const session = createMockActiveSession()
  session.status = 'active'
  session.elapsedMinutes = 0
  session.startTime = new Date()
  session.currentCharge = 0
  void userInfo
  return { success: true as const, session }
}

export async function completeRentalFromApi(session: ActiveSession) {
  await new Promise((r) => setTimeout(r, 1200))
  const qualified = session.elapsedMinutes >= session.rewardThreshold
  const reward = qualified ? createMockReward(session.id) : undefined
  return { success: true as const, qualifiedForReward: qualified, reward }
}

export async function cancelRentalFromApi(_sessionId: string, _sessionCode?: string) {
  /* no-op */
}

export async function redeemRewardFromApi(_rewardId: string, _code: string) {
  await new Promise((r) => setTimeout(r, 500))
  return { success: true as const }
}

export function sessionFromCheckoutApi(_session: Record<string, unknown>, station: StationInfo) {
  const session = createMockActiveSession()
  session.stationId = station.id
  session.stationName = station.name
  return session
}
