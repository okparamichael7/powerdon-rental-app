/**
 * Dispatches outbound WsCharge frames to the TCP proxy process.
 */

import { logger } from '@/lib/observability/logger'
import { getWsChargeConfig } from './config'
import { incrementWsChargeMetric } from './metrics'

export async function dispatchCommandToTcpProxy(
  productSn: string,
  commandBuffer: Buffer
): Promise<{ dispatched: boolean; error?: string }> {
  const { proxyUrl } = getWsChargeConfig()
  if (!proxyUrl) {
    return { dispatched: false, error: 'TCP_PROXY_URL not configured' }
  }

  const url = `${proxyUrl.replace(/\/$/, '')}/command/${encodeURIComponent(productSn)}`
  const token = process.env.STATION_PROXY_TOKEN || process.env.TCP_PROXY_API_KEY

  let attempt = 0
  const maxAttempts = 3
  let lastError: string | undefined

  while (attempt < maxAttempts) {
    attempt++
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ commandHex: commandBuffer.toString('hex') }),
        signal: AbortSignal.timeout(10_000),
      })

      if (!response.ok) {
        lastError = `TCP proxy HTTP ${response.status}`
        const backoff = Math.min(1000 * 2 ** (attempt - 1), 8000) + Math.random() * 200
        await new Promise((r) => setTimeout(r, backoff))
        continue
      }

      incrementWsChargeMetric('messages_sent')
      logger.info('WsCharge command dispatched', {
        productSn,
        bytes: commandBuffer.length,
        attempt,
      })
      return { dispatched: true }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'dispatch failed'
      const backoff = Math.min(1000 * 2 ** (attempt - 1), 8000) + Math.random() * 200
      await new Promise((r) => setTimeout(r, backoff))
    }
  }

  incrementWsChargeMetric('handler_failures')
  logger.error('WsCharge command dispatch failed', { productSn, error: lastError, attempts: maxAttempts })
  return { dispatched: false, error: lastError }
}
