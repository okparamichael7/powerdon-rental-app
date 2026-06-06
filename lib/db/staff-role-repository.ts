import { createServiceClient } from '@/lib/supabase/admin'

export type StaffRoleType = 'admin' | 'operator'

export interface DbStaffRole {
  id: string
  auth_user_id: string
  role: StaffRoleType
  email: string
  granted_by: string | null
  granted_at: string
  revoked_at: string | null
  revoked_by: string | null
  notes: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface GrantStaffRoleInput {
  authUserId: string
  email: string
  role: StaffRoleType
  grantedBy: string
  notes?: string
}

class StaffRoleRepository {
  async getActiveRole(authUserId: string): Promise<StaffRoleType | null> {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('staff_roles')
      .select('role')
      .eq('auth_user_id', authUserId)
      .is('revoked_at', null)
      .maybeSingle()

    if (error) throw error
    return (data?.role as StaffRoleType) ?? null
  }

  async hasActiveStaffAccess(authUserId: string): Promise<boolean> {
    const role = await this.getActiveRole(authUserId)
    return role !== null
  }

  async listActive(): Promise<DbStaffRole[]> {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('staff_roles')
      .select('*')
      .is('revoked_at', null)
      .order('granted_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as DbStaffRole[]
  }

  async countActive(): Promise<number> {
    const supabase = await createServiceClient()
    const { count, error } = await supabase
      .from('staff_roles')
      .select('*', { count: 'exact', head: true })
      .is('revoked_at', null)

    if (error) throw error
    return count ?? 0
  }

  async countActiveByRole(role: StaffRoleType): Promise<number> {
    const supabase = await createServiceClient()
    const { count, error } = await supabase
      .from('staff_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role', role)
      .is('revoked_at', null)

    if (error) throw error
    return count ?? 0
  }

  async grant(input: GrantStaffRoleInput): Promise<DbStaffRole> {
    const supabase = await createServiceClient()

    const { data: existing } = await supabase
      .from('staff_roles')
      .select('id, role')
      .eq('auth_user_id', input.authUserId)
      .is('revoked_at', null)
      .maybeSingle()

    if (existing) {
      if (existing.role === input.role) {
        const { data: row } = await supabase
          .from('staff_roles')
          .select('*')
          .eq('id', existing.id)
          .single()
        return row as DbStaffRole
      }
      await this.revoke(input.authUserId, input.grantedBy)
    }

    const { data, error } = await supabase
      .from('staff_roles')
      .insert({
        auth_user_id: input.authUserId,
        role: input.role,
        email: input.email.toLowerCase(),
        granted_by: input.grantedBy,
        notes: input.notes ?? null,
        metadata: {},
      })
      .select('*')
      .single()

    if (error) throw error
    return data as DbStaffRole
  }

  async revoke(authUserId: string, revokedBy: string): Promise<void> {
    const supabase = await createServiceClient()
    const { error } = await supabase
      .from('staff_roles')
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: revokedBy,
      })
      .eq('auth_user_id', authUserId)
      .is('revoked_at', null)

    if (error) throw error
  }

  async findAuthUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
    const supabase = await createServiceClient()
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (error) throw error

    const normalized = email.trim().toLowerCase()
    const match = data.users.find(
      (u: { id: string; email?: string }) => u.email?.toLowerCase() === normalized,
    )
    if (!match?.id || !match.email) return null
    return { id: match.id, email: match.email }
  }
}

export const staffRoleRepository = new StaffRoleRepository()
