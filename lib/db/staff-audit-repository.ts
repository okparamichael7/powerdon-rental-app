import { createServiceClient } from '@/lib/supabase/admin'
import type { StaffRoleType } from './staff-role-repository'

export type StaffAuditAction = 'grant' | 'revoke' | 'role_change'

export interface DbStaffAuditLog {
  id: string
  actor_auth_user_id: string | null
  target_auth_user_id: string
  action: StaffAuditAction
  role: StaffRoleType | null
  details: Record<string, unknown>
  created_at: string
}

class StaffAuditRepository {
  async log(input: {
    actorAuthUserId: string
    targetAuthUserId: string
    action: StaffAuditAction
    role?: StaffRoleType | null
    details?: Record<string, unknown>
  }): Promise<void> {
    const supabase = await createServiceClient()
    const { error } = await supabase.from('staff_audit_log').insert({
      actor_auth_user_id: input.actorAuthUserId,
      target_auth_user_id: input.targetAuthUserId,
      action: input.action,
      role: input.role ?? null,
      details: input.details ?? {},
    })
    if (error) throw error
  }

  async listRecent(limit = 50): Promise<DbStaffAuditLog[]> {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('staff_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data ?? []) as DbStaffAuditLog[]
  }
}

export const staffAuditRepository = new StaffAuditRepository()
