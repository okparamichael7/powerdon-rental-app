// Support service - handles all support ticket operations
// Production implementation using Supabase

import type { 
  ApiResponse,
  SupportTicket,
  SupportTicketFilters,
  CreateSupportTicketRequest,
} from '@/lib/api/types';
import { 
  createSuccessResponse, 
  createErrorResponse,
  ErrorCodes,
} from '@/lib/api/client';
import { createClient } from '@/lib/supabase/client';

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

// Static FAQ data (these could be moved to database if needed)
export const faqs: FAQ[] = [
  {
    id: 'faq-1',
    category: 'rental',
    question: 'How do I start a rental?',
    answer: 'Scan the QR code on any PowerDon charging station to begin. You will need to provide your email and authorize a refundable security deposit. Once authorized, your designated slot will unlock automatically.',
    relatedActions: [
      { label: 'Find a Station', action: 'find-station' },
    ],
  },
  {
    id: 'faq-2',
    category: 'rental',
    question: 'How do I return the power bank?',
    answer: 'Return your power bank to any available slot at any PowerDon station. Simply insert the power bank into an empty slot and wait for the confirmation beep. Your deposit will be refunded automatically within minutes.',
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

// Transform database ticket to API ticket type
function transformTicket(dbTicket: {
  id: string;
  ticket_number: string;
  category: string;
  subject: string;
  description: string;
  session_id: string | null;
  user_email: string;
  user_name: string | null;
  status: string;
  priority: string;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}): SupportTicket {
  return {
    id: dbTicket.id,
    ticketNumber: dbTicket.ticket_number,
    category: dbTicket.category as SupportTicket['category'],
    subject: dbTicket.subject,
    description: dbTicket.description,
    sessionId: dbTicket.session_id || undefined,
    userEmail: dbTicket.user_email,
    userName: dbTicket.user_name || undefined,
    status: dbTicket.status as SupportTicket['status'],
    priority: dbTicket.priority as SupportTicket['priority'],
    resolution: dbTicket.resolution || undefined,
    createdAt: new Date(dbTicket.created_at),
    updatedAt: new Date(dbTicket.updated_at),
    resolvedAt: dbTicket.resolved_at ? new Date(dbTicket.resolved_at) : undefined,
  };
}

// Production implementation using Supabase
class SupabaseSupportService implements ISupportService {
  async getTickets(filters?: SupportTicketFilters): Promise<ApiResponse<SupportTicket[]>> {
    try {
      const supabase = createClient();
      
      let query = supabase
        .from('support_tickets')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters?.category && filters.category.length > 0) {
        query = query.in('category', filters.category);
      }

      if (filters?.priority && filters.priority.length > 0) {
        query = query.in('priority', filters.priority);
      }

      if (filters?.search) {
        query = query.or(`ticket_number.ilike.%${filters.search}%,subject.ilike.%${filters.search}%,user_email.ilike.%${filters.search}%`);
      }

      // Apply pagination
      const page = filters?.page || 1;
      const limit = filters?.limit || 50;
      const start = (page - 1) * limit;
      query = query.range(start, start + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('[SupportService] Error fetching tickets:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch tickets');
      }

      const tickets = (data || []).map(transformTicket);

      return createSuccessResponse(tickets, {
        page,
        limit,
        total: count || tickets.length,
      });
    } catch (err) {
      console.error('[SupportService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getTicketById(id: string): Promise<ApiResponse<SupportTicket>> {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[SupportService] Error fetching ticket:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch ticket');
      }

      if (!data) {
        return createErrorResponse(ErrorCodes.TICKET_NOT_FOUND, `Ticket ${id} not found`);
      }

      return createSuccessResponse(transformTicket(data));
    } catch (err) {
      console.error('[SupportService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getTicketByNumber(ticketNumber: string): Promise<ApiResponse<SupportTicket>> {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('ticket_number', ticketNumber.toUpperCase())
        .maybeSingle();

      if (error) {
        console.error('[SupportService] Error fetching ticket by number:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch ticket');
      }

      if (!data) {
        return createErrorResponse(ErrorCodes.TICKET_NOT_FOUND, `Ticket ${ticketNumber} not found`);
      }

      return createSuccessResponse(transformTicket(data));
    } catch (err) {
      console.error('[SupportService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async getTicketsByUser(userEmail: string): Promise<ApiResponse<SupportTicket[]>> {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_email', userEmail.toLowerCase())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[SupportService] Error fetching user tickets:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to fetch user tickets');
      }

      const tickets = (data || []).map(transformTicket);

      return createSuccessResponse(tickets);
    } catch (err) {
      console.error('[SupportService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async createTicket(request: CreateSupportTicketRequest): Promise<ApiResponse<SupportTicket>> {
    try {
      const supabase = createClient();
      
      const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`;
      
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          ticket_number: ticketNumber,
          category: request.category,
          subject: request.subject,
          description: request.description,
          session_id: request.sessionId,
          user_email: request.userEmail.toLowerCase(),
          user_name: request.userName,
          status: 'open',
          priority: request.priority || 'medium',
        })
        .select()
        .single();

      if (error) {
        console.error('[SupportService] Error creating ticket:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to create ticket');
      }

      return createSuccessResponse(transformTicket(data));
    } catch (err) {
      console.error('[SupportService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }

  async updateTicketStatus(
    id: string, 
    status: SupportTicket['status'], 
    resolution?: string
  ): Promise<ApiResponse<SupportTicket>> {
    try {
      const supabase = createClient();
      
      // First check current status
      const { data: existingTicket } = await supabase
        .from('support_tickets')
        .select('status')
        .eq('id', id)
        .maybeSingle();

      if (!existingTicket) {
        return createErrorResponse(ErrorCodes.TICKET_NOT_FOUND, `Ticket ${id} not found`);
      }

      if (existingTicket.status === 'closed') {
        return createErrorResponse(ErrorCodes.TICKET_ALREADY_CLOSED, 'This ticket has already been closed');
      }

      const updates: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (resolution) {
        updates.resolution = resolution;
      }

      if (status === 'resolved' || status === 'closed') {
        updates.resolved_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('support_tickets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[SupportService] Error updating ticket:', error);
        return createErrorResponse(ErrorCodes.SERVER_ERROR, 'Failed to update ticket');
      }

      return createSuccessResponse(transformTicket(data));
    } catch (err) {
      console.error('[SupportService] Unexpected error:', err);
      return createErrorResponse(ErrorCodes.SERVER_ERROR, 'An unexpected error occurred');
    }
  }
}

// Export singleton instance and FAQs - now using real Supabase implementation
export const supportService: ISupportService = new SupabaseSupportService();
export { faqs as supportFaqs };
