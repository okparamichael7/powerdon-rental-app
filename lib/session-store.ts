// Session store for managing rental state across the app
// In production, this would be backed by an API and persistent storage

import { calculateRentalCharge } from '@/lib/stripe/types';

export type RentalState = 
  | 'idle'
  | 'starting'
  | 'unlocking'
  | 'active'
  | 'returning'
  | 'completed'
  | 'failed';

export type RewardState = 
  | 'not_qualified'
  | 'in_progress'
  | 'qualified'
  | 'pending_issuance'
  | 'issued'
  | 'redeemed'
  | 'expired'
  | 'failed';

export interface ActiveSession {
  id: string;
  sessionCode: string;
  stationId: string;
  stationName: string;
  slotNumber: number;
  startTime: Date;
  elapsedMinutes: number;
  hourlyRate: number;
  dailyCap: number;
  depositAmount: number;
  currentCharge: number;
  rewardThreshold: number;
  rewardDescription: string;
  rewardValue: number;
  campaignId?: string;
  campaignName: string;
  status: RentalState;
  lastSyncTime: Date;
}

export interface UserReward {
  id: string;
  code: string;
  sessionId: string;
  campaignId: string;
  campaignName: string;
  type: 'voucher' | 'discount' | 'freebie';
  value: number;
  description: string;
  status: RewardState;
  issuedAt: Date;
  expiresAt: Date;
  redeemedAt?: Date;
  redemptionLocation?: string;
  qualificationMinutes: number;
  actualMinutes: number;
}

export interface StationInfo {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'maintenance' | 'busy';
  availableSlots: number;
  totalSlots: number;
  campaignId?: string;
  campaignName: string;
  hourlyRate: number;
  dailyCap: number;
  depositAmount: number;
  rewardThreshold: number;
  rewardDescription: string;
  rewardValue: number;
}

export interface UserInfo {
  email: string;
  name?: string;
  termsAccepted: boolean;
  marketingConsent: boolean;
}

// Mock station data - EUR Ladder Pricing
// Pre-auth: €28, First 5 min free, €1/15min after, €27 daily cap
export const mockStation: StationInfo = {
  id: 'A12',
  name: 'Main Stage Hub',
  location: 'Near Main Stage entrance',
  status: 'online',
  availableSlots: 8,
  totalSlots: 12,
  campaignId: 'CMP-001',
  campaignName: 'Sundance Festival',
  hourlyRate: 4.00, // €1/15min = €4/hr equivalent (for display only)
  dailyCap: 27.00,
  depositAmount: 28.00,
  rewardThreshold: 60,
  rewardDescription: 'Rent for 60 mins and get a €10 voucher for Sundance merch.',
  rewardValue: 10,
};

// Mock active session for demo purposes
// EUR Ladder Pricing: Pre-auth €28, First 5 min free, €1/15min, €27 daily cap
export const createMockActiveSession = (): ActiveSession => ({
  id: `SES-${Date.now()}`,
  sessionCode: 'VR-882194B',
  stationId: 'A12',
  stationName: 'Main Stage Hub',
  slotNumber: 4,
  startTime: new Date(Date.now() - 45 * 60 * 1000), // Started 45 minutes ago
  elapsedMinutes: 45,
  hourlyRate: 4.00, // €1/15min = €4/hr equivalent
  dailyCap: 27.00,
  depositAmount: 28.00,
  currentCharge: 3.00, // 45 min = 5 free + 40 chargeable = ceil(40/15) * €1 = 3 intervals = €3
  rewardThreshold: 60,
  rewardDescription: 'Rent for 60 mins and get a €10 voucher for Sundance merch.',
  rewardValue: 10,
  campaignId: 'CMP-001',
  campaignName: 'Sundance Festival',
  status: 'active',
  lastSyncTime: new Date(),
});

// Mock reward for demo
export const createMockReward = (sessionId: string): UserReward => ({
  id: `RWD-${Date.now()}`,
  code: `SUNDANCE-POWERDON-${new Date().getFullYear()}`,
  sessionId,
  campaignId: 'CMP-001',
  campaignName: 'Sundance Festival',
  type: 'voucher',
  value: 10,
  description: '€10 Merch Voucher',
  status: 'issued',
  issuedAt: new Date(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expires in 24 hours
  qualificationMinutes: 60,
  actualMinutes: 72,
});

// Helper to format time duration
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

// Helper to format currency
export function formatCurrency(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

/** Client charge estimate using the same Stripe ladder as server finalize. */
export function calculateCharge(elapsedMinutes: number, _hourlyRate: number, _dailyCap: number): number {
  const { totalCents } = calculateRentalCharge(Math.max(0, elapsedMinutes));
  return Math.round(totalCents) / 100;
}

// Calculate reward progress percentage
export function calculateRewardProgress(elapsedMinutes: number, threshold: number): number {
  return Math.min((elapsedMinutes / threshold) * 100, 100);
}
