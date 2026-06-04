// External integration interfaces
// These define the contracts for third-party service integrations
// Implementations would connect to actual providers in production

import type {
  PaymentIntentRequest,
  PaymentIntentResponse,
  PaymentAuthorizationRequest,
  PaymentAuthorizationResponse,
  PaymentCaptureRequest,
  PaymentRefundRequest,
  HardwareCommand,
  HardwareResponse,
  SendEmailRequest,
  EmailTemplate,
} from '@/lib/api/types';

// ============================================================
// PAYMENT PROVIDER INTEGRATION (Stripe, Adyen, etc.)
// ============================================================

export interface IPaymentProvider {
  /**
   * Create a payment intent for deposit authorization
   */
  createPaymentIntent(request: PaymentIntentRequest): Promise<PaymentIntentResponse>;
  
  /**
   * Authorize a hold on the customer's payment method
   */
  authorizePayment(request: PaymentAuthorizationRequest): Promise<PaymentAuthorizationResponse>;
  
  /**
   * Capture funds from an authorized payment
   */
  capturePayment(request: PaymentCaptureRequest): Promise<{ success: boolean; captureId: string }>;
  
  /**
   * Release an authorization without capturing
   */
  releaseAuthorization(authorizationId: string): Promise<{ success: boolean }>;
  
  /**
   * Refund a captured payment
   */
  refundPayment(request: PaymentRefundRequest): Promise<{ success: boolean; refundId: string }>;
  
  /**
   * Get payment status
   */
  getPaymentStatus(paymentId: string): Promise<{ status: string; amount: number }>;
}

// Mock payment provider for development
export const mockPaymentProvider: IPaymentProvider = {
  async createPaymentIntent(request) {
    await new Promise(r => setTimeout(r, 500));
    return {
      clientSecret: `pi_${Date.now()}_secret`,
      paymentIntentId: `pi_${Date.now()}`,
      status: 'requires_payment_method',
    };
  },
  
  async authorizePayment(request) {
    await new Promise(r => setTimeout(r, 500));
    return {
      authorizationId: `auth_${Date.now()}`,
      status: 'authorized',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
  },
  
  async capturePayment(request) {
    await new Promise(r => setTimeout(r, 300));
    return { success: true, captureId: `cap_${Date.now()}` };
  },
  
  async releaseAuthorization(authorizationId) {
    await new Promise(r => setTimeout(r, 300));
    return { success: true };
  },
  
  async refundPayment(request) {
    await new Promise(r => setTimeout(r, 300));
    return { success: true, refundId: `ref_${Date.now()}` };
  },
  
  async getPaymentStatus(paymentId) {
    await new Promise(r => setTimeout(r, 200));
    return { status: 'authorized', amount: 2500 };
  },
};

// ============================================================
// HARDWARE/VENDOR INTEGRATION (PowerDon Station API)
// ============================================================

export interface IHardwareProvider {
  /**
   * Send a command to a station
   */
  sendCommand(command: HardwareCommand): Promise<HardwareResponse>;
  
  /**
   * Unlock a specific slot
   */
  unlockSlot(stationId: string, slotNumber: number): Promise<HardwareResponse>;
  
  /**
   * Get station status
   */
  getStationStatus(stationId: string): Promise<{
    isOnline: boolean;
    batteryLevel: number;
    availableSlots: number[];
    lastPing: Date;
  }>;
  
  /**
   * Register return of power bank
   */
  registerReturn(stationId: string, slotNumber: number, powerBankId: string): Promise<{
    success: boolean;
    batteryLevelReturned: number;
  }>;
  
  /**
   * Ping station for health check
   */
  pingStation(stationId: string): Promise<{ latencyMs: number; isHealthy: boolean }>;
}

// Mock hardware provider for development
export const mockHardwareProvider: IHardwareProvider = {
  async sendCommand(command) {
    await new Promise(r => setTimeout(r, 800));
    return {
      success: true,
      stationId: command.stationId,
      command: command.command,
      result: { executed: true },
      timestamp: new Date(),
    };
  },
  
  async unlockSlot(stationId, slotNumber) {
    await new Promise(r => setTimeout(r, 1000));
    // Simulate 5% failure rate
    const success = Math.random() > 0.05;
    return {
      success,
      stationId,
      command: 'unlock',
      result: success ? { slotNumber, unlocked: true } : undefined,
      errorCode: success ? undefined : 'UNLOCK_TIMEOUT',
      errorMessage: success ? undefined : 'Slot unlock timed out',
      timestamp: new Date(),
    };
  },
  
  async getStationStatus(stationId) {
    await new Promise(r => setTimeout(r, 300));
    return {
      isOnline: true,
      batteryLevel: Math.floor(Math.random() * 30) + 70,
      availableSlots: [1, 3, 5, 7, 9, 11],
      lastPing: new Date(),
    };
  },
  
  async registerReturn(stationId, slotNumber, powerBankId) {
    await new Promise(r => setTimeout(r, 500));
    return {
      success: true,
      batteryLevelReturned: Math.floor(Math.random() * 40) + 10,
    };
  },
  
  async pingStation(stationId) {
    const start = Date.now();
    await new Promise(r => setTimeout(r, Math.random() * 100 + 50));
    return {
      latencyMs: Date.now() - start,
      isHealthy: true,
    };
  },
};

// ============================================================
// EMAIL/CRM INTEGRATION (SendGrid, Mailchimp, etc.)
// ============================================================

export interface IEmailProvider {
  /**
   * Send a transactional email
   */
  sendEmail(request: SendEmailRequest): Promise<{ success: boolean; messageId: string }>;
  
  /**
   * Get available email templates
   */
  getTemplates(): Promise<EmailTemplate[]>;
  
  /**
   * Add contact to CRM/mailing list
   */
  addContact(email: string, name?: string, tags?: string[]): Promise<{ success: boolean; contactId: string }>;
  
  /**
   * Update contact preferences
   */
  updateContactPreferences(email: string, preferences: {
    marketingOptIn?: boolean;
    transactionalOptIn?: boolean;
  }): Promise<{ success: boolean }>;
  
  /**
   * Remove contact from mailing list
   */
  unsubscribeContact(email: string): Promise<{ success: boolean }>;
}

// Email template IDs
export const EmailTemplates = {
  RENTAL_STARTED: 'rental_started',
  RENTAL_COMPLETED: 'rental_completed',
  REWARD_ISSUED: 'reward_issued',
  REWARD_EXPIRING: 'reward_expiring',
  DEPOSIT_REFUNDED: 'deposit_refunded',
  SESSION_EXPIRED: 'session_expired',
  SUPPORT_TICKET_CREATED: 'support_ticket_created',
  SUPPORT_TICKET_RESOLVED: 'support_ticket_resolved',
} as const;

// Mock email provider for development
export const mockEmailProvider: IEmailProvider = {
  async sendEmail(request) {
    await new Promise(r => setTimeout(r, 200));
    console.log(`[MockEmail] Sending ${request.templateId} to ${request.to}`);
    return { success: true, messageId: `msg_${Date.now()}` };
  },
  
  async getTemplates() {
    return [
      { id: EmailTemplates.RENTAL_STARTED, name: 'Rental Started', subject: 'Your PowerDon rental has started', type: 'transactional' },
      { id: EmailTemplates.RENTAL_COMPLETED, name: 'Rental Completed', subject: 'Your PowerDon rental is complete', type: 'transactional' },
      { id: EmailTemplates.REWARD_ISSUED, name: 'Reward Issued', subject: 'You earned a reward!', type: 'transactional' },
      { id: EmailTemplates.DEPOSIT_REFUNDED, name: 'Deposit Refunded', subject: 'Your deposit has been refunded', type: 'transactional' },
    ];
  },
  
  async addContact(email, name, tags) {
    await new Promise(r => setTimeout(r, 200));
    console.log(`[MockEmail] Adding contact ${email}`);
    return { success: true, contactId: `contact_${Date.now()}` };
  },
  
  async updateContactPreferences(email, preferences) {
    await new Promise(r => setTimeout(r, 100));
    console.log(`[MockEmail] Updating preferences for ${email}`, preferences);
    return { success: true };
  },
  
  async unsubscribeContact(email) {
    await new Promise(r => setTimeout(r, 100));
    console.log(`[MockEmail] Unsubscribing ${email}`);
    return { success: true };
  },
};

// ============================================================
// REWARD PROVIDER INTEGRATION (For voucher management)
// ============================================================

export interface IRewardProvider {
  /**
   * Issue a new voucher/reward
   */
  issueVoucher(params: {
    value: number;
    currency: string;
    userId: string;
    expiresAt: Date;
    metadata?: Record<string, string>;
  }): Promise<{ voucherId: string; code: string }>;
  
  /**
   * Validate a voucher code
   */
  validateVoucher(code: string): Promise<{
    isValid: boolean;
    value?: number;
    expiresAt?: Date;
    isRedeemed?: boolean;
  }>;
  
  /**
   * Redeem a voucher
   */
  redeemVoucher(code: string, location: string): Promise<{
    success: boolean;
    redeemedAt: Date;
  }>;
  
  /**
   * Get voucher status
   */
  getVoucherStatus(code: string): Promise<{
    status: 'active' | 'redeemed' | 'expired' | 'cancelled';
    value: number;
    issuedAt: Date;
    expiresAt: Date;
    redeemedAt?: Date;
  }>;
}

// Mock reward provider for development
export const mockRewardProvider: IRewardProvider = {
  async issueVoucher(params) {
    await new Promise(r => setTimeout(r, 300));
    const code = `POWERDON-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${new Date().getFullYear()}`;
    return { voucherId: `voucher_${Date.now()}`, code };
  },
  
  async validateVoucher(code) {
    await new Promise(r => setTimeout(r, 200));
    return {
      isValid: true,
      value: 10.00,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isRedeemed: false,
    };
  },
  
  async redeemVoucher(code, location) {
    await new Promise(r => setTimeout(r, 300));
    return { success: true, redeemedAt: new Date() };
  },
  
  async getVoucherStatus(code) {
    await new Promise(r => setTimeout(r, 200));
    return {
      status: 'active',
      value: 10.00,
      issuedAt: new Date(Date.now() - 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000),
    };
  },
};

// ============================================================
// EXPORTED INTEGRATION INSTANCES
// ============================================================

// Payment/email/reward integrations: use Stripe + DB in production flows.
// Hardware control uses lib/wscharge stationManager and /api/stations routes directly.
export const paymentProvider = mockPaymentProvider;
export const hardwareProvider = mockHardwareProvider;
export const emailProvider = mockEmailProvider;
export const rewardProvider = mockRewardProvider;
