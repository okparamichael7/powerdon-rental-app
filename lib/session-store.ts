// Session store for managing rental state across the app
// In production, this would be backed by an API and persistent storage

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
  campaignId: string;
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
  campaignId: string;
  campaignName: string;
  hourlyRate: number;
  dailyCap: number;
  depositAmount: number;
  rewardThreshold: number;
  rewardDescription: string;
}

export interface UserInfo {
  email: string;
  name?: string;
  termsAccepted: boolean;
  marketingConsent: boolean;
}

// Mock station data
export const mockStation: StationInfo = {
  id: 'A12',
  name: 'Main Stage Hub',
  location: 'Near Main Stage entrance',
  status: 'online',
  availableSlots: 8,
  totalSlots: 12,
  campaignId: 'CMP-001',
  campaignName: 'Sundance Festival',
  hourlyRate: 2.00,
  dailyCap: 10.00,
  depositAmount: 25.00,
  rewardThreshold: 60,
  rewardDescription: 'Rent for 60 mins and get a €10 voucher for Sundance merch.',
};

// Mock active session for demo purposes
export const createMockActiveSession = (): ActiveSession => ({
  id: `SES-${Date.now()}`,
  sessionCode: 'VR-882194B',
  stationId: 'A12',
  stationName: 'Main Stage Hub',
  slotNumber: 4,
  startTime: new Date(Date.now() - 45 * 60 * 1000), // Started 45 minutes ago
  elapsedMinutes: 45,
  hourlyRate: 2.00,
  dailyCap: 10.00,
  depositAmount: 25.00,
  currentCharge: 1.50,
  rewardThreshold: 60,
  rewardDescription: 'Rent for 60 mins and get a €10 voucher for Sundance merch.',
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

// Calculate current charge based on elapsed time
export function calculateCharge(elapsedMinutes: number, hourlyRate: number, dailyCap: number): number {
  const charge = (elapsedMinutes / 60) * hourlyRate;
  return Math.min(charge, dailyCap);
}

// Calculate reward progress percentage
export function calculateRewardProgress(elapsedMinutes: number, threshold: number): number {
  return Math.min((elapsedMinutes / threshold) * 100, 100);
}
