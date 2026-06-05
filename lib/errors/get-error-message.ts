/**
 * Normalize unknown thrown values (Supabase PostgrestError, Stripe, etc.) to a string.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    if (typeof record.message === 'string') return record.message
    if (typeof record.error === 'string') return record.error
    try {
      return JSON.stringify(error)
    } catch {
      return 'Unknown error'
    }
  }
  return 'Unknown error'
}

export function getErrorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const { name, message, stack, ...rest } = error as Error & Record<string, unknown>
    return { name, message, stack, ...rest }
  }
  if (error && typeof error === 'object') {
    return error as Record<string, unknown>
  }
  return { message: getErrorMessage(error) }
}
