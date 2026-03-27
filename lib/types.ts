// Core domain types for PowerDon rental platform

export type SessionStatus = 'pending' | 'active' | 'completed' | 'expired' | 'failed';
export type StationStatus = 'online' | 'offline' | 'maintenance' | 'low-battery';
export type RewardStatus = 'pending' | 'qualified' | 'issued' | 'redeemed' | 'expired';
export type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'refunded' | 'failed';

export interface Station {
  id: string;
  name: string;
  location: string;
  status: StationStatus;
  totalSlots: number;
  availableSlots: number;
  batteryLevel: number;
  lastPing: Date;
  campaignId?: string;
}

export interface Campaign {
  id: string;
  name: string;
  eventName: string;
  startDate: Date;
  endDate: Date;
  hourlyRate: number;
  dailyCap: number;
  depositAmount: number;
  rewardThresholdMinutes: number;
  rewardType: 'voucher' | 'discount' | 'freebie';
  rewardValue: number;
  rewardDescription: string;
  isActive: boolean;
  totalSessions: number;
  totalRewardsIssued: number;
}

export interface RentalSession {
  id: string;
  sessionCode: string;
  stationId: string;
  stationName: string;
  slotNumber: number;
  userId: string;
  userEmail: string;
  userName?: string;
  status: SessionStatus;
  startTime: Date;
  endTime?: Date;
  durationMinutes?: number;
  depositAmount: number;
  amountCharged: number;
  amountRefunded: number;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  rewardStatus: RewardStatus;
  rewardCode?: string;
  campaignId: string;
  campaignName: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  createdAt: Date;
  totalRentals: number;
  totalSpent: number;
  marketingConsent: boolean;
  lastRentalDate?: Date;
}

export interface Reward {
  id: string;
  code: string;
  sessionId: string;
  userId: string;
  userEmail: string;
  campaignId: string;
  campaignName: string;
  type: 'voucher' | 'discount' | 'freebie';
  value: number;
  description: string;
  status: RewardStatus;
  issuedAt: Date;
  expiresAt: Date;
  redeemedAt?: Date;
  redemptionLocation?: string;
}

export interface DashboardStats {
  totalSessions: number;
  activeSessions: number;
  totalRevenue: number;
  totalDepositsHeld: number;
  totalRewardsIssued: number;
  totalRewardsRedeemed: number;
  averageSessionDuration: number;
  conversionRate: number;
  stationsOnline: number;
  stationsTotal: number;
}

export interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: 'scan' | 'auth' | 'unlock' | 'payment' | 'return' | 'reward' | 'refund' | 'error';
  description: string;
  metadata?: Record<string, string | number>;
}


