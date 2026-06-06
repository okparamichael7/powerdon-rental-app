/**
 * Test data factories — realistic shapes matching lib/db/types.ts
 */

import type { DbRentalSession, SessionStatus, PaymentStatus } from '@/lib/db/types'
import { TEST_CAMPAIGN_ID, TEST_SESSION_ID, TEST_STATION_ID, TEST_USER_ID } from '../helpers/env'

let sessionCodeCounter = 1000

export function buildSessionCode(): string {
  sessionCodeCounter += 1
  return `PD${String(sessionCodeCounter).padStart(6, '0')}`.slice(0, 8).padEnd(8, '0')
}

export interface RentalSessionFactoryOptions {
  id?: string
  status?: SessionStatus
  paymentStatus?: PaymentStatus
  sessionCode?: string
  unlockToken?: string
  unlockTokenExpiresAt?: string | null
  paymentIntentId?: string | null
  userId?: string
  stationId?: string
  campaignId?: string | null
  slotNumber?: number
}

export function buildRentalSession(overrides: RentalSessionFactoryOptions = {}): DbRentalSession {
  const now = new Date().toISOString()
  return {
    id: overrides.id ?? TEST_SESSION_ID,
    session_code: overrides.sessionCode ?? buildSessionCode(),
    user_id: overrides.userId ?? TEST_USER_ID,
    campaign_id: overrides.campaignId ?? TEST_CAMPAIGN_ID,
    status: overrides.status ?? 'pending',
    payment_status: overrides.paymentStatus ?? 'pending',
    pickup_station_id: overrides.stationId ?? TEST_STATION_ID,
    pickup_slot_number: overrides.slotNumber ?? 1,
    power_bank_id: null,
    return_station_id: null,
    return_slot_number: null,
    deposit_amount: 28,
    hourly_rate: 4,
    daily_cap: 27,
    amount_charged: 0,
    amount_refunded: 0,
    payment_method: 'card',
    reward_threshold_minutes: 60,
    reward_qualified: false,
    reward_status: 'pending',
    reward_id: null,
    payment_intent_id: overrides.paymentIntentId ?? null,
    payment_authorization_id: null,
    unlock_token: overrides.unlockToken ?? 'a'.repeat(32),
    unlock_token_expires_at: overrides.unlockTokenExpiresAt ?? new Date(Date.now() + 30 * 60_000).toISOString(),
    started_at: null,
    ended_at: null,
    duration_minutes: null,
    metadata: {},
    created_at: now,
    updated_at: now,
  }
}

export function buildRentalStartPayload(overrides: Record<string, unknown> = {}) {
  return {
    stationId: TEST_STATION_ID,
    userEmail: 'customer@powerdon.test',
    userName: 'Test Customer',
    phone: '+491701234567',
    marketingConsent: false,
    ...overrides,
  }
}

export function buildSupportTicketPayload(overrides: Record<string, unknown> = {}) {
  return {
    email: 'customer@powerdon.test',
    subject: 'Payment issue with rental',
    description: 'I was charged twice for my power bank rental at the event.',
    category: 'payment_issue',
    priority: 'medium',
    website: '',
    ...overrides,
  }
}

export function buildGrantStaffPayload(overrides: Record<string, unknown> = {}) {
  return {
    email: 'operator@powerdon.test',
    role: 'operator',
    notes: 'Test operator account',
    ...overrides,
  }
}

export function buildCreateStaffPayload(overrides: Record<string, unknown> = {}) {
  return {
    email: 'newstaff@powerdon.test',
    provisionMethod: 'password',
    password: 'SecurePass123',
    role: 'operator',
    notes: 'Provisioned from dashboard',
    ...overrides,
  }
}

export function buildInviteStaffPayload(overrides: Record<string, unknown> = {}) {
  return {
    email: 'invited@powerdon.test',
    provisionMethod: 'invite',
    role: 'operator',
    notes: 'Invited from dashboard',
    ...overrides,
  }
}
