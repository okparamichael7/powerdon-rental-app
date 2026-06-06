export const STAFF_PASSWORD_MIN_LENGTH = 12
export const STAFF_PASSWORD_MAX_LENGTH = 128

/**
 * Enterprise password policy for staff accounts provisioned by admins.
 * Returns a user-safe error message, or null if valid.
 */
export function validateStaffPassword(password: string): string | null {
  if (password.length < STAFF_PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${STAFF_PASSWORD_MIN_LENGTH} characters`
  }
  if (password.length > STAFF_PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${STAFF_PASSWORD_MAX_LENGTH} characters`
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include a lowercase letter'
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include an uppercase letter'
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include a number'
  }
  return null
}
