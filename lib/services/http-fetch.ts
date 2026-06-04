import type { ApiResponse } from '@/lib/api/types'
import { createErrorResponse } from '@/lib/api/client'

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
    const body = await res.json()
    if (!res.ok) {
      return createErrorResponse(
        body.code || 'REQUEST_FAILED',
        body.error || body.message || `Request failed (${res.status})`,
        body,
      )
    }
    if (body.success === false) {
      return createErrorResponse(body.error?.code || 'ERROR', body.error?.message || body.error || 'Request failed')
    }
    return {
      success: true,
      data: body.data ?? body,
      meta: body.meta,
    }
  } catch (err) {
    return createErrorResponse(
      'NETWORK_ERROR',
      err instanceof Error ? err.message : 'Network request failed',
    )
  }
}
