/**
 * Staff role resolution — prefers app_metadata (not user-editable) over user_metadata.
 */
export type StaffRole = 'admin' | 'operator' | null

export function resolveStaffRole(metadata: {
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}): StaffRole {
  const app = metadata.app_metadata ?? {}
  const user = metadata.user_metadata ?? {}

  if (app.is_admin === true || app.role === 'admin') return 'admin'
  if (user.is_admin === true || user.role === 'admin') return 'admin'
  if (app.role === 'operator' || user.role === 'operator') return 'operator'
  if (app.is_staff === true || user.is_staff === true) return 'operator'

  return null
}

export function isStaffFromMetadata(metadata: {
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}): boolean {
  return resolveStaffRole(metadata) !== null
}
