import type {
  Campaign,
  DashboardStats,
  RentalSession,
  Reward,
  Station,
  TimelineEvent,
  User,
} from '@/lib/types'
import type { SupportTicket } from '@/lib/api/types'
import type { DbSupportTicket } from '@/lib/db/types'
import type {
  DbCampaign,
  DbReward,
  DbRentalSession,
  DbSessionEvent,
  DbUser,
} from '@/lib/db/types'
import type { SessionWithRelations } from '@/lib/db/session-repository'
import type { StationWithSlots } from '@/lib/db/station-repository'

function mapStationStatus(status: string): Station['status'] {
  if (status === 'low_battery') return 'low-battery'
  if (status === 'error' || status === 'offline' || status === 'maintenance') {
    return status === 'maintenance' ? 'maintenance' : status === 'offline' ? 'offline' : 'offline'
  }
  return 'online'
}

export function mapStationFromDb(station: StationWithSlots): Station {
  const occupied = station.slots?.filter((s) => s.status === 'occupied').length ?? station.occupied_slots ?? 0
  const available = station.available_slots ?? Math.max(0, station.total_slots - occupied)
  const avgBattery =
    station.slots?.length > 0
      ? Math.round(
          station.slots.reduce((sum, s) => sum + (s.battery_level ?? 0), 0) / station.slots.length,
        )
      : 0

  return {
    id: station.id,
    name: station.name,
    location: station.location ?? '',
    status: mapStationStatus(station.status),
    totalSlots: station.total_slots,
    availableSlots: available,
    batteryLevel: avgBattery,
    lastPing: station.last_heartbeat ? new Date(station.last_heartbeat) : new Date(),
    campaignId: station.campaign_id ?? undefined,
  }
}

export function mapCampaignFromDb(c: DbCampaign, stats?: { sessions?: number; rewards?: number }): Campaign {
  return {
    id: c.id,
    name: c.name,
    eventName: c.event_name,
    startDate: new Date(c.start_date),
    endDate: new Date(c.end_date),
    hourlyRate: Number(c.hourly_rate),
    dailyCap: Number(c.daily_cap),
    depositAmount: Number(c.deposit_amount),
    rewardThresholdMinutes: c.reward_threshold_minutes,
    rewardType: (c.reward_type as Campaign['rewardType']) || 'voucher',
    rewardValue: Number(c.reward_value),
    rewardDescription: c.reward_description ?? '',
    isActive: c.is_active,
    totalSessions: stats?.sessions ?? 0,
    totalRewardsIssued: stats?.rewards ?? 0,
  }
}

export function mapUserFromDb(u: DbUser): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name ?? undefined,
    phone: u.phone ?? undefined,
    createdAt: new Date(u.created_at),
    totalRentals: u.total_rentals ?? 0,
    totalSpent: Number(u.total_spent ?? 0),
    marketingConsent: u.marketing_consent ?? false,
    lastRentalDate: u.last_rental_at ? new Date(u.last_rental_at) : undefined,
  }
}

export function normalizeSessionReward(reward: SessionWithRelations['reward']): DbReward | null {
  if (!reward) return null
  if (Array.isArray(reward)) return reward[0] ?? null
  return reward
}

function rewardCodeFromRelation(reward: SessionWithRelations['reward']): string | undefined {
  return normalizeSessionReward(reward)?.code
}

export function mapSessionFromDb(s: SessionWithRelations, campaignName?: string): RentalSession {
  return {
    id: s.id,
    sessionCode: s.session_code,
    stationId: s.pickup_station_id ?? '',
    stationName: s.pickup_station?.name ?? 'Unknown Station',
    slotNumber: s.pickup_slot_number ?? 0,
    userId: s.user_id,
    userEmail: s.user?.email ?? '',
    userName: s.user?.name ?? undefined,
    status: s.status as RentalSession['status'],
    startTime: s.started_at ? new Date(s.started_at) : new Date(s.created_at),
    endTime: s.ended_at ? new Date(s.ended_at) : undefined,
    durationMinutes: s.duration_minutes ?? undefined,
    depositAmount: Number(s.deposit_amount),
    amountCharged: Number(s.amount_charged ?? 0),
    amountRefunded: Number(s.amount_refunded ?? 0),
    paymentMethod: s.payment_method ?? 'card',
    paymentStatus: s.payment_status as RentalSession['paymentStatus'],
    rewardStatus: (s.reward_status ?? 'pending') as RentalSession['rewardStatus'],
    rewardCode: rewardCodeFromRelation(s.reward),
    campaignId: s.campaign_id ?? '',
    campaignName: campaignName ?? '',
  }
}

export function mapRewardFromDb(r: DbReward, userEmail?: string, campaignName?: string): Reward {
  return {
    id: r.id,
    code: r.code,
    sessionId: r.session_id,
    userId: r.user_id,
    userEmail: userEmail ?? '',
    campaignId: r.campaign_id,
    campaignName: campaignName ?? '',
    type: (r.reward_type as Reward['type']) || 'voucher',
    value: Number(r.value),
    description: r.description ?? '',
    status: r.status as Reward['status'],
    issuedAt: new Date(r.issued_at),
    expiresAt: new Date(r.expires_at),
    redeemedAt: r.redeemed_at ? new Date(r.redeemed_at) : undefined,
    redemptionLocation: r.redemption_location ?? undefined,
  }
}

export function mapTimelineFromDb(e: DbSessionEvent): TimelineEvent {
  return {
    id: e.id,
    timestamp: new Date(e.created_at),
    type: e.event_type as TimelineEvent['type'],
    description: e.description,
    metadata: (e.metadata as Record<string, string | number>) ?? undefined,
  }
}

export function mapDashboardFromAggregates(data: {
  totalSessions: number
  activeSessions: number
  totalRevenue: number
  totalDepositsHeld: number
  totalRewardsIssued: number
  totalRewardsRedeemed: number
  averageSessionDuration: number
  conversionRate: number
  stationsOnline: number
  stationsTotal: number
}): DashboardStats {
  return { ...data }
}

export function mapDbSessionToActiveSession(
  s: SessionWithRelations,
  campaign?: { name: string; reward_description?: string | null },
) {
  const started = s.started_at ? new Date(s.started_at) : new Date()
  const elapsed = s.duration_minutes ?? Math.floor((Date.now() - started.getTime()) / 60000)
  const hourlyCharge = (elapsed / 60) * Number(s.hourly_rate)
  const currentCharge = Math.min(hourlyCharge, Number(s.daily_cap))

  return {
    id: s.id,
    sessionCode: s.session_code,
    stationId: s.pickup_station_id,
    stationName: s.pickup_station?.name ?? 'Station',
    slotNumber: s.pickup_slot_number,
    startTime: started,
    elapsedMinutes: elapsed,
    hourlyRate: Number(s.hourly_rate),
    dailyCap: Number(s.daily_cap),
    depositAmount: Number(s.deposit_amount),
    currentCharge,
    rewardThreshold: s.reward_threshold_minutes ?? 60,
    rewardDescription: campaign?.reward_description ?? 'Event reward',
    campaignId: s.campaign_id ?? '',
    campaignName: campaign?.name ?? 'Campaign',
    status: s.status === 'pending' ? 'unlocking' : 'active',
    lastSyncTime: new Date(),
  } as const
}

export function mapSupportTicketFromDb(ticket: DbSupportTicket): SupportTicket {
  const meta = (ticket.metadata && typeof ticket.metadata === 'object' ? ticket.metadata : {}) as Record<
    string,
    unknown
  >
  return {
    id: ticket.id,
    ticketNumber: ticket.ticket_number,
    category: ticket.category,
    subject: ticket.subject,
    description: ticket.description,
    sessionId: ticket.session_id ?? undefined,
    userEmail: String(meta.contact_email ?? ''),
    userName: meta.contact_name ? String(meta.contact_name) : undefined,
    status: ticket.status as SupportTicket['status'],
    priority: ticket.priority as SupportTicket['priority'],
    createdAt: new Date(ticket.created_at),
    updatedAt: new Date(ticket.updated_at),
    resolvedAt: ticket.resolved_at ? new Date(ticket.resolved_at) : undefined,
    resolution: ticket.resolution ?? undefined,
  }
}
