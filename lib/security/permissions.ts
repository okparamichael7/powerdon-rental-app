import type { AuthContext } from '@/lib/security/auth'

export type HardwarePermission =
  | 'hardware.read'
  | 'hardware.create'
  | 'hardware.update'
  | 'hardware.archive'
  | 'hardware.delete'
  | 'hardware.slot.manage'
  | 'operations_hub.read'
  | 'operations_hub.manage_links'

const ADMIN_PERMISSIONS: HardwarePermission[] = [
  'hardware.read',
  'hardware.create',
  'hardware.update',
  'hardware.archive',
  'hardware.delete',
  'hardware.slot.manage',
  'operations_hub.read',
  'operations_hub.manage_links',
]

const OPERATOR_PERMISSIONS: HardwarePermission[] = [
  'hardware.read',
  'hardware.slot.manage',
  'operations_hub.read',
]

export function getPermissionsForRole(role: AuthContext['role']): HardwarePermission[] {
  if (role === 'admin' || role === 'service') return ADMIN_PERMISSIONS
  if (role === 'operator') return OPERATOR_PERMISSIONS
  return []
}

export function hasPermission(auth: AuthContext, permission: HardwarePermission): boolean {
  return getPermissionsForRole(auth.role).includes(permission)
}

export function permissionDeniedMessage(permission: HardwarePermission): string {
  return `Missing required permission: ${permission}`
}
