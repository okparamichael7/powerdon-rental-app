import { createServiceClient } from '@/lib/supabase/admin'
import type { DbSupportTicket, SupportCategory, SupportPriority, SupportStatus } from './types'

export interface SupportTicketFilters {
  status?: SupportStatus[]
  userEmail?: string
  limit?: number
}

class SupportRepository {
  async getAll(filters?: SupportTicketFilters): Promise<DbSupportTicket[]> {
    const supabase = createServiceClient()
    let query = supabase.from('support_tickets').select('*').order('created_at', { ascending: false })
    if (filters?.status?.length) query = query.in('status', filters.status)
    if (filters?.userEmail) {
      query = query.contains('metadata', { contact_email: filters.userEmail.toLowerCase() })
    }
    if (filters?.limit) query = query.limit(filters.limit)
    const { data, error } = await query
    if (error) throw error
    return (data || []) as DbSupportTicket[]
  }

  async getById(id: string): Promise<DbSupportTicket | null> {
    const supabase = createServiceClient()
    const { data, error } = await supabase.from('support_tickets').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data as DbSupportTicket | null
  }

  async getByNumber(ticketNumber: string): Promise<DbSupportTicket | null> {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('ticket_number', ticketNumber)
      .maybeSingle()
    if (error) throw error
    return data as DbSupportTicket | null
  }

  async update(
    id: string,
    patch: Partial<Pick<DbSupportTicket, 'status' | 'resolution' | 'priority' | 'assigned_to'>>,
  ): Promise<DbSupportTicket> {
    const supabase = createServiceClient()
    const updates: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() }
    if (patch.status === 'resolved' && !updates.resolved_at) {
      updates.resolved_at = new Date().toISOString()
    }
    const { data, error } = await supabase.from('support_tickets').update(updates).eq('id', id).select().single()
    if (error) throw error
    return data as DbSupportTicket
  }

  async create(input: {
    userId?: string
    sessionId?: string
    email: string
    category: SupportCategory
    subject: string
    description: string
    priority?: SupportPriority
  }): Promise<DbSupportTicket> {
    const supabase = createServiceClient()

    let userId = input.userId
    if (!userId) {
      const { data: user } = await supabase.from('users').select('id').eq('email', input.email.toLowerCase()).maybeSingle()
      userId = user?.id
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: userId,
        session_id: input.sessionId,
        category: input.category,
        priority: input.priority ?? 'medium',
        status: 'open',
        subject: input.subject,
        description: input.description,
        metadata: { contact_email: input.email },
      })
      .select()
      .single()

    if (error) throw error
    return data
  }
}

export const supportRepository = new SupportRepository()
