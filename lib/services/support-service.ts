// Support service - handles all support ticket operations
// Mock implementation with interface ready for real backend

import type { 
  ApiResponse,
  SupportTicket,
  SupportTicketFilters,
  CreateSupportTicketRequest,
} from '@/lib/api/types';
import { 
  simulateNetworkDelay, 
  createSuccessResponse, 
  createErrorResponse,
  ErrorCodes,
  generateId,
} from '@/lib/api/client';

// Support service interface
export interface ISupportService {
  getTickets(filters?: SupportTicketFilters): Promise<ApiResponse<SupportTicket[]>>;
  getTicketById(id: string): Promise<ApiResponse<SupportTicket>>;
  getTicketByNumber(ticketNumber: string): Promise<ApiResponse<SupportTicket>>;
  getTicketsByUser(userEmail: string): Promise<ApiResponse<SupportTicket[]>>;
  createTicket(request: CreateSupportTicketRequest): Promise<ApiResponse<SupportTicket>>;
  updateTicketStatus(id: string, status: SupportTicket['status'], resolution?: string): Promise<ApiResponse<SupportTicket>>;
}

// FAQ structure
export interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
  relatedActions?: { label: string; action: string }[];
}

// In-memory ticket store
let tickets: SupportTicket[] = [];

// Static FAQ data
export const faqs: FAQ[] = [
  {
    id: 'faq-1',
    category: 'rental',
    question: 'How do I start a rental?',
    answer: 'Scan the QR code on any Powerdon charging station to begin. You will need to provide your email and authorize a refundable security deposit. Once authorized, your designated slot will unlock automatically.',
    relatedActions: [
      { label: 'Find a Station', action: 'find-station' },
    ],
  },
  {
    id: 'faq-2',
    category: 'rental',
    question: 'How do I return the power bank?',
    answer: 'Return your power bank to any available slot at any Powerdon station. Simply insert the power bank into an empty slot and wait for the confirmation beep. Your deposit will be refunded automatically within minutes.',
    relatedActions: [
      { label: 'View Active Rental', action: 'view-rental' },
    ],
  },
  {
    id: 'faq-3',
    category: 'payment',
    question: 'How much does it cost?',
    answer: 'Rental rates vary by event and location. Typical rates are around €2.00 per hour with a daily cap of €10.00. A refundable security deposit (usually €25.00) is held during your rental and returned when you bring back the power bank.',
  },
  {
    id: 'faq-4',
    category: 'payment',
    question: 'When will I get my deposit back?',
    answer: 'Your security deposit is refunded automatically once you return the power bank to any station. Refunds typically appear within 5-10 business days depending on your payment provider, though most refunds are processed instantly.',
  },
  {
    id: 'faq-5',
    category: 'payment',
    question: 'What if I lose the power bank?',
    answer: 'If a power bank is not returned within 24 hours, your security deposit will be captured as payment. Please contact support if you have lost a power bank or are unable to return it.',
    relatedActions: [
      { label: 'Contact Support', action: 'contact-support' },
    ],
  },
  {
    id: 'faq-6',
    category: 'rewards',
    question: 'How do I earn rewards?',
    answer: 'Rewards are tied to specific campaigns and events. Typically, you need to rent a power bank for a minimum duration (e.g., 60 minutes) to qualify for a reward. Check the reward details when starting your rental.',
    relatedActions: [
      { label: 'View Rewards', action: 'view-rewards' },
    ],
  },
  {
    id: 'faq-7',
    category: 'rewards',
    question: 'How do I redeem my reward?',
    answer: 'Once you qualify for a reward, you will receive a unique code. Present this code at the designated redemption location (e.g., merchandise booth) to claim your reward. Rewards typically expire within 24 hours.',
  },
  {
    id: 'faq-8',
    category: 'technical',
    question: 'The slot will not unlock',
    answer: 'First, ensure you are standing near the correct slot number shown on your screen. The LED should be flashing blue. If it still does not unlock after 30 seconds, try tapping "Retry" in the app. If the issue persists, contact support.',
    relatedActions: [
      { label: 'Contact Support', action: 'contact-support' },
    ],
  },
  {
    id: 'faq-9',
    category: 'technical',
    question: 'The station shows offline',
    answer: 'If a station shows as offline, please try a different station nearby. You can find other stations on the map. If multiple stations are offline, there may be a temporary network issue.',
    relatedActions: [
      { label: 'Find Another Station', action: 'find-station' },
    ],
  },
  {
    id: 'faq-10',
    category: 'account',
    question: 'How do I check my rental history?',
    answer: 'Your rental history is linked to your email address. Enter your email on the Status page or contact support with your email to retrieve your rental history.',
    relatedActions: [
      { label: 'Check Status', action: 'check-status' },
    ],
  },
];

// Mock implementation
class MockSupportService implements ISupportService {
  async getTickets(filters?: SupportTicketFilters): Promise<ApiResponse<SupportTicket[]>> {
    await simulateNetworkDelay();

    let result = [...tickets];

    // Apply filters
    if (filters?.status && filters.status.length > 0) {
      result = result.filter(t => filters.status!.includes(t.status));
    }

    if (filters?.category && filters.category.length > 0) {
      result = result.filter(t => filters.category!.includes(t.category));
    }

    if (filters?.priority && filters.priority.length > 0) {
      result = result.filter(t => filters.priority!.includes(t.priority));
    }

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(t => 
        t.ticketNumber.toLowerCase().includes(search) || 
        t.subject.toLowerCase().includes(search) ||
        t.userEmail.toLowerCase().includes(search)
      );
    }

    // Sort by created date (newest first)
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const start = (page - 1) * limit;
    const paginated = result.slice(start, start + limit);

    return createSuccessResponse(paginated, {
      page,
      limit,
      total: result.length,
    });
  }

  async getTicketById(id: string): Promise<ApiResponse<SupportTicket>> {
    await simulateNetworkDelay();

    const ticket = tickets.find(t => t.id === id);
    
    if (!ticket) {
      return createErrorResponse(
        ErrorCodes.TICKET_NOT_FOUND,
        `Ticket ${id} not found`
      );
    }

    return createSuccessResponse(ticket);
  }

  async getTicketByNumber(ticketNumber: string): Promise<ApiResponse<SupportTicket>> {
    await simulateNetworkDelay();

    const ticket = tickets.find(t => t.ticketNumber === ticketNumber);
    
    if (!ticket) {
      return createErrorResponse(
        ErrorCodes.TICKET_NOT_FOUND,
        `Ticket ${ticketNumber} not found`
      );
    }

    return createSuccessResponse(ticket);
  }

  async getTicketsByUser(userEmail: string): Promise<ApiResponse<SupportTicket[]>> {
    await simulateNetworkDelay();

    const userTickets = tickets.filter(t => t.userEmail === userEmail);
    
    // Sort by created date (newest first)
    userTickets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return createSuccessResponse(userTickets);
  }

  async createTicket(request: CreateSupportTicketRequest): Promise<ApiResponse<SupportTicket>> {
    await simulateNetworkDelay();

    const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`;
    
    const newTicket: SupportTicket = {
      id: generateId('TKT'),
      ticketNumber,
      category: request.category,
      subject: request.subject,
      description: request.description,
      sessionId: request.sessionId,
      userEmail: request.userEmail,
      userName: request.userName,
      status: 'open',
      priority: request.priority || 'medium',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    tickets.unshift(newTicket);

    return createSuccessResponse(newTicket);
  }

  async updateTicketStatus(
    id: string, 
    status: SupportTicket['status'], 
    resolution?: string
  ): Promise<ApiResponse<SupportTicket>> {
    await simulateNetworkDelay();

    const ticketIndex = tickets.findIndex(t => t.id === id);
    
    if (ticketIndex === -1) {
      return createErrorResponse(
        ErrorCodes.TICKET_NOT_FOUND,
        `Ticket ${id} not found`
      );
    }

    const ticket = tickets[ticketIndex];

    if (ticket.status === 'closed') {
      return createErrorResponse(
        ErrorCodes.TICKET_ALREADY_CLOSED,
        'This ticket has already been closed'
      );
    }

    tickets[ticketIndex] = {
      ...ticket,
      status,
      resolution: resolution || ticket.resolution,
      updatedAt: new Date(),
      resolvedAt: status === 'resolved' || status === 'closed' ? new Date() : ticket.resolvedAt,
    };

    return createSuccessResponse(tickets[ticketIndex]);
  }
}

// Export singleton instance and FAQs
export const supportService: ISupportService = new MockSupportService();
export { faqs as supportFaqs };
