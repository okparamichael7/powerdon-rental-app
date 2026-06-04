import { createServiceClient } from '@/lib/supabase/admin'
import { staffRoleRepository, type StaffRoleType } from '@/lib/db/staff-role-repository'
import { logger } from '@/lib/observability/logger'

/**
 * Mirror staff_roles into Supabase Auth app_metadata so JWT claims stay aligned with RLS helpers.
 * app_metadata is not client-writable; staff_roles remains the source of truth.
 */
export async function syncAuthStaffMetadata(authUserId: string): Promise<StaffRoleType | null> {
  const role = await staffRoleRepository.getActiveRole(authUserId)
  const supabase = await createServiceClient()

  const appMetadata =
    role === 'admin'
      ? { is_admin: true, is_staff: true, role: 'admin' }
      : role === 'operator'
        ? { is_admin: false, is_staff: true, role: 'operator' }
        : { is_admin: false, is_staff: false, role: null }

  const { error } = await supabase.auth.admin.updateUserById(authUserId, {
    app_metadata: appMetadata,
  })

  if (error) {
    logger.error('Failed to sync auth app_metadata for staff', {
      authUserId,
      error: error.message,
    })
    throw error
  }

  return role
}
