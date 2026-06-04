/**
 * Safe post-auth redirects — blocks open redirects.
 */
const DEFAULT_ADMIN_PATH = '/admin'

const ALLOWED_PREFIXES = ['/admin', '/']

export function sanitizeRedirectPath(next: string | null | undefined): string {
  if (!next || typeof next !== 'string') return DEFAULT_ADMIN_PATH
  const trimmed = next.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return DEFAULT_ADMIN_PATH
  }
  if (trimmed.includes('://') || trimmed.includes('\\')) {
    return DEFAULT_ADMIN_PATH
  }
  const allowed = ALLOWED_PREFIXES.some(
    (prefix) => trimmed === prefix || trimmed.startsWith(`${prefix}`),
  )
  return allowed ? trimmed : DEFAULT_ADMIN_PATH
}
