const STORAGE_PREFIX = 'powerdon:session-token:'

export function saveSessionToken(sessionId: string, token: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${sessionId}`, token)
    sessionStorage.setItem(`${STORAGE_PREFIX}code:${sessionId}`, token)
  } catch {
    // sessionStorage unavailable
  }
}

export function getSessionToken(sessionId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(`${STORAGE_PREFIX}${sessionId}`)
  } catch {
    return null
  }
}

export function sessionAuthHeaders(sessionId: string): Record<string, string> {
  const token = getSessionToken(sessionId)
  return token ? { 'X-Session-Token': token } : {}
}
