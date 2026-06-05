import type { Station, Campaign, RentalSession, User, Reward, DashboardStats, TimelineEvent } from '@/lib/types'
import type {
  ApiResponse,
  StationFilters,
  StationAvailabilityRequest,
  StationAvailabilityResponse,
  SessionFilters,
  StartRentalRequest,
  StartRentalResponse,
  UnlockRequest,
  UnlockResponse,
  ReturnRequest,
  ReturnResponse,
  SessionLookupRequest,
  SupportTicket,
  SupportTicketFilters,
  CreateSupportTicketRequest,
  RevenueAnalytics,
  FunnelAnalytics,
  SessionAnalytics,
  RewardAnalytics,
  AnalyticsDateRange,
  RedeemRewardRequest,
  RedeemRewardResponse,
} from '@/lib/api/types'
import { createSuccessResponse, createErrorResponse, ErrorCodes } from '@/lib/api/client'
import { apiFetch } from './http-fetch'
import type { IStationService } from './station-service'
import type { IRentalService } from './rental-service'
import type { ICampaignService } from './campaign-service'
import type { IRewardService } from './reward-service'
import type { IUserService } from './user-service'
import type { IAnalyticsService } from './analytics-service'
import type { ISupportService } from './support-service'

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export class ProductionStationService implements IStationService {
  async getStations(filters?: StationFilters): Promise<ApiResponse<Station[]>> {
    const res = await apiFetch<Array<Record<string, unknown>>>(
      `/api/stations${buildQuery({
        source: 'database',
        status: filters?.status?.[0],
        campaignId: filters?.campaignId,
        search: filters?.search,
      })}`,
    )
    if (!res.success) {
      return createErrorResponse(res.error?.code ?? ErrorCodes.SERVER_ERROR, res.error?.message ?? 'Request failed')
    }
    if (!res.data) return createSuccessResponse([])
    const rows = Array.isArray(res.data) ? res.data : []
    const stations: Station[] = rows.map((s) => ({
      id: String(s.id),
      name: String(s.name),
      location: String(s.location ?? ''),
      status: (s.isOnline ? 'online' : String(s.status ?? 'offline')) as Station['status'],
      totalSlots: Number(s.totalSlots ?? 12),
      availableSlots: Number(s.availableSlots ?? 0),
      batteryLevel: 0,
      lastPing: s.lastHeartbeat ? new Date(String(s.lastHeartbeat)) : new Date(),
      campaignId: s.campaignId ? String(s.campaignId) : undefined,
    }))
    return createSuccessResponse(stations, res.meta)
  }

  async getStationById(id: string): Promise<ApiResponse<Station>> {
    const res = await apiFetch<{ data: Record<string, unknown> }>(`/api/stations/${id}?source=database`)
    if (!res.success) {
      return createErrorResponse(res.error?.code ?? ErrorCodes.SERVER_ERROR, res.error?.message ?? 'Request failed')
    }
    const raw = res.data as { data?: Record<string, unknown> } | Record<string, unknown>
    const s = ('data' in raw && raw.data ? raw.data : raw) as Record<string, unknown>
    return createSuccessResponse({
      id: String(s.id ?? id),
      name: String(s.name ?? 'Station'),
      location: String(s.location ?? ''),
      status: (s.isOnline ? 'online' : 'offline') as Station['status'],
      totalSlots: Number(s.totalSlots ?? 12),
      availableSlots: Number(s.availableSlots ?? 0),
      batteryLevel: 0,
      lastPing: new Date(),
      campaignId: s.campaignId ? String(s.campaignId) : undefined,
    })
  }

  async checkAvailability(req: StationAvailabilityRequest): Promise<ApiResponse<StationAvailabilityResponse>> {
    const station = await this.getStationById(req.stationId)
    if (!station.success || !station.data) {
      return createErrorResponse(ErrorCodes.NOT_FOUND, 'Station not found')
    }
    return createSuccessResponse({
      stationId: req.stationId,
      isAvailable: station.data.status === 'online' && station.data.availableSlots > 0,
      availableSlots: station.data.availableSlots,
      estimatedWaitMinutes: 0,
    })
  }

  async getStationsByCampaign(campaignId: string): Promise<ApiResponse<Station[]>> {
    return this.getStations({ campaignId })
  }

  async updateStationStatus(id: string, status: Station['status']): Promise<ApiResponse<Station>> {
    const res = await apiFetch<Station>(`/api/admin/stations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: status === 'low-battery' ? 'low_battery' : status }),
    })
    return res
  }
}

export class ProductionRentalService implements IRentalService {
  async getSessions(filters?: SessionFilters): Promise<ApiResponse<RentalSession[]>> {
    return apiFetch<RentalSession[]>(`/api/admin/sessions${buildQuery({
      status: filters?.status?.join(','),
      search: filters?.search,
      stationId: filters?.stationId,
      campaignId: filters?.campaignId,
      limit: filters?.limit,
    })}`)
  }

  async getSessionById(id: string): Promise<ApiResponse<RentalSession>> {
    return apiFetch<RentalSession>(`/api/admin/sessions/${id}`)
  }

  async getSessionByCode(code: string): Promise<ApiResponse<RentalSession>> {
    return apiFetch<RentalSession>(`/api/admin/sessions/by-code/${encodeURIComponent(code)}`)
  }

  async lookupSession(request: SessionLookupRequest): Promise<ApiResponse<RentalSession | null>> {
    if (request.sessionCode) return this.getSessionByCode(request.sessionCode)
    if (request.sessionId) return this.getSessionById(request.sessionId)
    return createErrorResponse(ErrorCodes.INVALID_REQUEST, 'sessionId or sessionCode required')
  }

  async getActiveSessionByUser(userEmail: string): Promise<ApiResponse<RentalSession | null>> {
    return apiFetch<RentalSession | null>(`/api/admin/sessions/active?email=${encodeURIComponent(userEmail)}`)
  }

  async startRental(request: StartRentalRequest): Promise<ApiResponse<StartRentalResponse>> {
    const res = await fetch('/api/rentals/start', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    const body = await res.json()
    if (!res.ok || !body.success) {
      return createErrorResponse(ErrorCodes.PAYMENT_FAILED, body.error || 'Failed to start rental')
    }
    return createSuccessResponse({
      sessionId: body.session.id,
      sessionCode: body.session.sessionCode,
      unlockToken: body.session.unlockToken,
      slotNumber: body.session.slotNumber,
      depositAmount: body.session.depositAmount,
      paymentAuthorizationId:
        body.session.paymentAuthorizationId ?? body.session.paymentIntentId ?? '',
    })
  }

  async unlockPowerBank(request: UnlockRequest): Promise<ApiResponse<UnlockResponse>> {
    const sessionRes = await this.getSessionById(request.sessionId)
    if (!sessionRes.success || !sessionRes.data) {
      return createErrorResponse(
        sessionRes.error?.code ?? ErrorCodes.SESSION_NOT_FOUND,
        sessionRes.error?.message ?? 'Session not found',
      )
    }
    const res = await fetch(`/api/stations/${sessionRes.data.stationId}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: request.sessionId,
        unlockToken: request.unlockToken,
        slotNumber: sessionRes.data.slotNumber,
      }),
    })
    const body = await res.json()
    if (!body.success) return createErrorResponse(ErrorCodes.UNLOCK_FAILED, body.error)
    const data = body.data ?? body
    return createSuccessResponse({
      success: true,
      slotNumber: Number(data.slotNumber ?? sessionRes.data.slotNumber),
      batteryLevel: Number(data.batteryLevel ?? 100),
      estimatedChargeMinutes: 120,
    })
  }

  async returnPowerBank(request: ReturnRequest): Promise<ApiResponse<ReturnResponse>> {
    return createErrorResponse(ErrorCodes.RETURN_FAILED, 'Return is handled by hardware events')
  }

  async cancelSession(sessionId: string): Promise<ApiResponse<void>> {
    const res = await fetch(`/api/rentals/${sessionId}/cancel`, { method: 'POST' })
    const body = await res.json()
    if (!body.success) return createErrorResponse(ErrorCodes.SESSION_NOT_FOUND, body.error)
    return createSuccessResponse(undefined as void)
  }

  async getSessionTimeline(sessionId: string): Promise<ApiResponse<TimelineEvent[]>> {
    return apiFetch<TimelineEvent[]>(`/api/admin/sessions/${sessionId}/timeline`)
  }
}

export class ProductionCampaignService implements ICampaignService {
  async toggleCampaignActive(id: string, isActive: boolean) {
    return this.updateCampaign(id, { isActive } as Parameters<ICampaignService['updateCampaign']>[1])
  }
  async getCampaigns(filters?: Parameters<ICampaignService['getCampaigns']>[0]) {
    return apiFetch<Campaign[]>(`/api/admin/campaigns${buildQuery({
      isActive: filters?.isActive,
      search: filters?.search,
    })}`)
  }
  async getCampaignById(id: string) {
    return apiFetch<Campaign>(`/api/admin/campaigns/${id}`)
  }
  async getActiveCampaigns() {
    return apiFetch<Campaign[]>('/api/admin/campaigns?isActive=true')
  }
  async createCampaign(request: Parameters<ICampaignService['createCampaign']>[0]) {
    return apiFetch<Campaign>('/api/admin/campaigns', { method: 'POST', body: JSON.stringify(request) })
  }
  async updateCampaign(id: string, request: Parameters<ICampaignService['updateCampaign']>[1]) {
    return apiFetch<Campaign>(`/api/admin/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(request) })
  }
  async deleteCampaign(id: string) {
    return apiFetch<void>(`/api/admin/campaigns/${id}`, { method: 'DELETE' })
  }
}

export class ProductionUserService implements IUserService {
  async getUserByEmail(email: string) {
    const res = await this.getUsers({ search: email })
    if (!res.success || !res.data) return createErrorResponse(ErrorCodes.NOT_FOUND, 'User not found') as ApiResponse<User | null>
    const user = res.data.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null
    return createSuccessResponse(user)
  }
  async updateMarketingConsent(id: string, consent: boolean) {
    return this.updateUser(id, { marketingConsent: consent } as Partial<User>)
  }
  async getUserStats() {
    const res = await this.getUsers()
    if (!res.success || !res.data) return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed') as ApiResponse<never>
    const users = res.data
    return createSuccessResponse({
      totalUsers: users.length,
      marketingOptIns: users.filter((u) => u.marketingConsent).length,
      activeRenters: users.filter((u) => (u.totalRentals ?? 0) > 0).length,
      repeatUsers: users.filter((u) => (u.totalRentals ?? 0) > 1).length,
    })
  }
  async getUsers(filters?: Parameters<IUserService['getUsers']>[0]) {
    return apiFetch<User[]>(`/api/admin/users${buildQuery({
      search: filters?.search,
      marketingConsent: filters?.marketingConsent,
      limit: filters?.limit,
    })}`)
  }
  async getUserById(id: string) {
    return apiFetch<User>(`/api/admin/users/${id}`)
  }
  async createUser(request: Parameters<IUserService['createUser']>[0]) {
    return apiFetch<User>('/api/admin/users', { method: 'POST', body: JSON.stringify(request) })
  }
  async updateUser(id: string, request: Parameters<IUserService['updateUser']>[1]) {
    return apiFetch<User>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(request) })
  }
}

export class ProductionRewardService implements IRewardService {
  async getRewardByCode(code: string): Promise<ApiResponse<Reward>> {
    const res = await this.getRewards({ search: code })
    if (!res.success) {
      return createErrorResponse(res.error?.code ?? ErrorCodes.NOT_FOUND, res.error?.message ?? 'Request failed')
    }
    const reward = res.data.find((r) => r.code === code)
    if (!reward) return createErrorResponse(ErrorCodes.NOT_FOUND, 'Reward not found')
    return createSuccessResponse(reward)
  }
  async getRewardsBySession(sessionId: string): Promise<ApiResponse<Reward[]>> {
    return apiFetch<Reward[]>(`/api/admin/rewards?sessionId=${sessionId}`)
  }
  async issueReward(sessionId: string, campaignId: string): Promise<ApiResponse<Reward>> {
    return apiFetch<Reward>('/api/admin/rewards/issue', {
      method: 'POST',
      body: JSON.stringify({ sessionId, campaignId }),
    })
  }
  async redeemReward(request: RedeemRewardRequest): Promise<ApiResponse<RedeemRewardResponse>> {
    return apiFetch<RedeemRewardResponse>(`/api/rewards/${request.rewardId}/redeem`, {
      method: 'POST',
      body: JSON.stringify({ location: request.redemptionLocation }),
    })
  }
  async getRewardStats(): Promise<ApiResponse<{
    totalIssued: number
    totalRedeemed: number
    totalExpired: number
    pendingRedemption: number
  }>> {
    const res = await this.getRewards()
    if (!res.success || !res.data) return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed') as ApiResponse<never>
    const rewards = res.data
    return createSuccessResponse({
      totalIssued: rewards.length,
      totalRedeemed: rewards.filter((r) => r.status === 'redeemed').length,
      totalExpired: rewards.filter((r) => r.status === 'expired').length,
      pendingRedemption: rewards.filter((r) => r.status === 'issued').length,
    })
  }
  async getRewards(filters?: Parameters<IRewardService['getRewards']>[0]): Promise<ApiResponse<Reward[]>> {
    return apiFetch<Reward[]>(`/api/admin/rewards${buildQuery({
      status: filters?.status?.join(','),
      search: filters?.search,
      limit: filters?.limit,
    })}`)
  }
  async getRewardById(id: string): Promise<ApiResponse<Reward>> {
    return apiFetch<Reward>(`/api/admin/rewards/${id}`)
  }
  async getRewardsByUser(userEmail: string): Promise<ApiResponse<Reward[]>> {
    return apiFetch<Reward[]>(`/api/admin/rewards?email=${encodeURIComponent(userEmail)}`)
  }
}

export class ProductionAnalyticsService implements IAnalyticsService {
  private analyticsUrl(type: string, dateRange?: AnalyticsDateRange): string {
    return `/api/admin/analytics${buildQuery({
      type,
      days: dateRange?.days ?? 30,
    })}`
  }

  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    return apiFetch<DashboardStats>('/api/admin/analytics?type=dashboard')
  }
  async getRevenueAnalytics(dateRange?: AnalyticsDateRange): Promise<ApiResponse<RevenueAnalytics>> {
    return apiFetch<RevenueAnalytics>(this.analyticsUrl('revenue', dateRange))
  }
  async getSessionAnalytics(dateRange?: AnalyticsDateRange): Promise<ApiResponse<SessionAnalytics>> {
    return apiFetch<SessionAnalytics>(this.analyticsUrl('sessions', dateRange))
  }
  async getRewardAnalytics(dateRange?: AnalyticsDateRange): Promise<ApiResponse<RewardAnalytics>> {
    return apiFetch<RewardAnalytics>(this.analyticsUrl('rewards', dateRange))
  }
  async getFunnelAnalytics(_campaignId?: string): Promise<ApiResponse<FunnelAnalytics>> {
    return apiFetch<FunnelAnalytics>('/api/admin/analytics?type=funnel')
  }
  async getHourlyDistribution(dateRange?: AnalyticsDateRange): Promise<ApiResponse<{ hour: string; count: number }[]>> {
    return apiFetch<{ hour: string; count: number }[]>(this.analyticsUrl('hourly', dateRange))
  }
  async getDailyRevenue(dateRange?: AnalyticsDateRange): Promise<ApiResponse<{ date: string; revenue: number; sessions: number }[]>> {
    return apiFetch<{ date: string; revenue: number; sessions: number }[]>(
      this.analyticsUrl('daily-revenue', dateRange),
    )
  }
  async getDurationDistribution(dateRange?: AnalyticsDateRange): Promise<ApiResponse<{ name: string; value: number; count: number; color: string }[]>> {
    return apiFetch(this.analyticsUrl('duration', dateRange))
  }
  async getRecentActivity(): Promise<ApiResponse<{ type: string; label: string; user: string; station: string; time: string }[]>> {
    return apiFetch('/api/admin/analytics?type=activity')
  }
}

export class ProductionSupportService implements ISupportService {
  async getTickets(filters?: SupportTicketFilters) {
    return apiFetch<SupportTicket[]>(`/api/admin/support${buildQuery({
      status: filters?.status?.join(','),
      limit: filters?.limit,
    })}`)
  }
  async getTicketById(id: string) {
    return apiFetch<SupportTicket>(`/api/admin/support/${id}`)
  }
  async getTicketByNumber(ticketNumber: string) {
    return apiFetch<SupportTicket>(`/api/admin/support/by-number/${ticketNumber}`)
  }
  async getTicketsByUser(userEmail: string) {
    return apiFetch<SupportTicket[]>(`/api/admin/support?email=${encodeURIComponent(userEmail)}`)
  }
  async createTicket(request: CreateSupportTicketRequest) {
    const res = await fetch('/api/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    const body = await res.json()
    if (!body.success) return createErrorResponse('ERROR', body.error)
    return createSuccessResponse(body.data)
  }
  async updateTicketStatus(id: string, status: SupportTicket['status'], resolution?: string) {
    return apiFetch<SupportTicket>(`/api/admin/support/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, resolution }),
    })
  }
}
