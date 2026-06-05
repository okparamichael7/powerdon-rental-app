/**
 * HTTP client for integration tests against a running Next.js server.
 */

export const DEFAULT_API_BASE = process.env.TEST_API_URL || 'http://localhost:3000'

export interface ApiResponse<T = unknown> {
  status: number
  data: T
  headers: Headers
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit & { baseUrl?: string } = {},
): Promise<ApiResponse<T>> {
  const { baseUrl = DEFAULT_API_BASE, ...init } = options
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  let data: T
  const text = await response.text()
  try {
    data = text ? (JSON.parse(text) as T) : (null as T)
  } catch {
    data = text as T
  }

  return { status: response.status, data, headers: response.headers }
}

export function withApiKey(apiKey: string, headers: Record<string, string> = {}): Record<string, string> {
  return { ...headers, 'x-api-key': apiKey }
}

export function withBearer(token: string, headers: Record<string, string> = {}): Record<string, string> {
  return { ...headers, Authorization: `Bearer ${token}` }
}

export function withSessionToken(token: string, headers: Record<string, string> = {}): Record<string, string> {
  return { ...headers, 'x-session-token': token }
}

/** Skip integration suite when no server is configured or reachable. */
export async function isServerReachable(baseUrl = DEFAULT_API_BASE): Promise<boolean> {
  if (process.env.SKIP_INTEGRATION_TESTS === '1') return false
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${baseUrl}/api/health`, { signal: controller.signal })
    clearTimeout(timeout)
    return res.status < 500
  } catch {
    return false
  }
}
