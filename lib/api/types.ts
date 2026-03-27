// API response and request types for backend integration

// Generic API response wrapper
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
}

// Pagination params
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Filter params
export interface DateRangeFilter {
  from?: Date;
  to?: Date;
}

// Station API types
export interface StationFilters extends PaginationParams {
  status?: ('online' | 'offline' | 'maintenance' | 'low-battery')[];
  campaignId?: string;
  search?: string;
}

export interface StationAvailabilityRequest {
  stationId: string;
}

export interface StationAvailabilityResponse {
  stationId: string;
  isAvailable: boolean;
  availableSlots: number;
  estimatedWaitMinutes?: number;
  nextAvailableSlot?: number;
}

// Rental session API types
export interface StartRentalRequest {
  stationId: string;
  slotNumber?: number;
  userEmail: string;
  userName?: string;
  marketingConsent: boolean;
  paymentMethodId: string;
  campaignId: string;
}

export interface StartRentalResponse {
  sessionId: string;
  sessionCode: string;
  slotNumber: number;
  depositAmount: number;
  paymentAuthorizationId: string;
  unlockToken: string;
}

export interface UnlockRequest {
  sessionId: string;
  unlockToken: string;
}

export interface UnlockResponse {
  success: boolean;
  slotNumber: number;
  batteryLevel: number;
  estimatedChargeMinutes: number;
}

export interface ReturnRequest {
  sessionId: string;
  stationId: string;
  slotNumber: number;
}

export interface ReturnResponse {
  success: boolean;
  returnStationId: string;
  returnSlotNumber: number;
  finalDurationMinutes: number;
  finalCharge: number;
  depositRefundAmount: number;
  rewardEarned: boolean;
  rewardId?: string;
}

export interface SessionFilters extends PaginationParams {
  status?: ('pending' | 'active' | 'completed' | 'expired' | 'failed')[];
  stationId?: string;
  campaignId?: string;
  userId?: string;
  dateRange?: DateRangeFilter;
  search?: string;
}

export interface SessionLookupRequest {
  sessionCode?: string;
  sessionId?: string;
  userEmail?: string;
}

// Campaign API types
export interface CampaignFilters extends PaginationParams {
  isActive?: boolean;
  search?: string;
  dateRange?: DateRangeFilter;
}

export interface CreateCampaignRequest {
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
  stationIds: string[];
}

export interface UpdateCampaignRequest extends Partial<CreateCampaignRequest> {
  isActive?: boolean;
}

// Reward API types
export interface RewardFilters extends PaginationParams {
  status?: ('pending' | 'qualified' | 'issued' | 'redeemed' | 'expired')[];
  campaignId?: string;
  userId?: string;
  dateRange?: DateRangeFilter;
  search?: string;
}

export interface RedeemRewardRequest {
  rewardId: string;
  rewardCode: string;
  redemptionLocation: string;
  staffId?: string;
}

export interface RedeemRewardResponse {
  success: boolean;
  rewardId: string;
  value: number;
  type: 'voucher' | 'discount' | 'freebie';
  redeemedAt: Date;
}

// User/Lead API types
export interface UserFilters extends PaginationParams {
  marketingConsent?: boolean;
  hasActiveRental?: boolean;
  dateRange?: DateRangeFilter;
  search?: string;
}

export interface CreateUserRequest {
  email: string;
  name?: string;
  phone?: string;
  marketingConsent: boolean;
}

// Support API types
export type SupportCategory = 
  | 'rental_issue'
  | 'payment_issue'
  | 'return_issue'
  | 'reward_issue'
  | 'station_issue'
  | 'account_issue'
  | 'other';

export type SupportPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SupportStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface CreateSupportTicketRequest {
  category: SupportCategory;
  subject: string;
  description: string;
  sessionId?: string;
  userEmail: string;
  userName?: string;
  priority?: SupportPriority;
  metadata?: Record<string, unknown>;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  category: SupportCategory;
  subject: string;
  description: string;
  sessionId?: string;
  userEmail: string;
  userName?: string;
  status: SupportStatus;
  priority: SupportPriority;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolution?: string;
}

export interface SupportTicketFilters extends PaginationParams {
  status?: SupportStatus[];
  category?: SupportCategory[];
  priority?: SupportPriority[];
  dateRange?: DateRangeFilter;
  search?: string;
}

// Analytics API types
export interface AnalyticsDateRange {
  from: Date;
  to: Date;
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

export interface RevenueAnalytics {
  totalRevenue: number;
  revenueByPeriod: { period: string; revenue: number; sessions: number }[];
  averageTransactionValue: number;
  refundTotal: number;
}

export interface SessionAnalytics {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  expiredSessions: number;
  averageDuration: number;
  sessionsByPeriod: { period: string; count: number }[];
  sessionsByStation: { stationId: string; stationName: string; count: number }[];
}

export interface RewardAnalytics {
  totalIssued: number;
  totalRedeemed: number;
  totalExpired: number;
  redemptionRate: number;
  rewardsByPeriod: { period: string; issued: number; redeemed: number }[];
}

export interface FunnelAnalytics {
  stages: { stage: string; count: number; conversionRate: number }[];
  overallConversion: number;
}

// Payment integration types (placeholder for Stripe, etc.)
export interface PaymentIntentRequest {
  amount: number;
  currency: string;
  customerId?: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'succeeded' | 'failed';
}

export interface PaymentAuthorizationRequest {
  paymentMethodId: string;
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
}

export interface PaymentAuthorizationResponse {
  authorizationId: string;
  status: 'pending' | 'authorized' | 'failed';
  expiresAt: Date;
}

export interface PaymentCaptureRequest {
  authorizationId: string;
  amount: number;
}

export interface PaymentRefundRequest {
  authorizationId: string;
  amount: number;
  reason?: string;
}

// Vendor/hardware integration types
export interface HardwareCommand {
  stationId: string;
  command: 'unlock' | 'lock' | 'status' | 'ping' | 'reboot';
  slotNumber?: number;
  payload?: Record<string, unknown>;
}

export interface HardwareResponse {
  success: boolean;
  stationId: string;
  command: string;
  result?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  timestamp: Date;
}

// CRM/Email integration types
export interface SendEmailRequest {
  to: string;
  templateId: string;
  data: Record<string, unknown>;
  metadata?: Record<string, string>;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  type: 'transactional' | 'marketing';
}
