const STORAGE_PREFIX = 'powerdon:session-token:'

export function saveSessionToken(
  sessionId: string,
  token: string,
  sessionCode?: string,
): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${sessionId}`, token)
    if (sessionCode) {
      sessionStorage.setItem(`${STORAGE_PREFIX}${sessionCode}`, token)
    }
  } catch {
    // sessionStorage unavailable
  }
}

export function getSessionToken(sessionIdOrCode: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(`${STORAGE_PREFIX}${sessionIdOrCode}`)
  } catch {
    return null
  }
}

export function sessionAuthHeaders(sessionIdOrCode: string): Record<string, string> {
  const token = getSessionToken(sessionIdOrCode)
  return token ? { 'X-Session-Token': token } : {}
}

/** Resolve unlock token from UUID and/or session code storage keys. */
export function rentalSessionAuthHeaders(
  sessionId: string,
  sessionCode?: string,
): Record<string, string> {
  const token =
    getSessionToken(sessionId) ?? (sessionCode ? getSessionToken(sessionCode) : null)
  return token ? { 'X-Session-Token': token } : {}
}
