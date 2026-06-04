import { staffRoleRepository, type StaffRoleType } from '@/lib/db/staff-role-repository'
import { resolveStaffRole, type StaffRole } from '@/lib/security/roles'

export interface StaffAccessResult {
  role: StaffRole
  source: 'database' | 'metadata' | null
}

/**
 * Resolve staff access: staff_roles table first, then legacy JWT metadata.
 */
export async function resolveStaffAccess(
  authUserId: string,
  metadata?: {
    app_metadata?: Record<string, unknown>
    user_metadata?: Record<string, unknown>
  },
): Promise<StaffAccessResult> {
  const dbRole = await staffRoleRepository.getActiveRole(authUserId)
  if (dbRole) {
    return { role: dbRole, source: 'database' }
  }

  const metaRole = metadata ? resolveStaffRole(metadata) : null
  if (metaRole) {
    return { role: metaRole, source: 'metadata' }
  }

  return { role: null, source: null }
}

export async function hasStaffAccess(
  authUserId: string,
  metadata?: {
    app_metadata?: Record<string, unknown>
    user_metadata?: Record<string, unknown>
  },
): Promise<boolean> {
  const { role } = await resolveStaffAccess(authUserId, metadata)
  return role !== null
}

export function staffRoleToAuthContext(role: StaffRoleType): {
  isAdmin: boolean
  role: 'admin' | 'operator'
} {
  return {
    isAdmin: role === 'admin',
    role,
  }
}
