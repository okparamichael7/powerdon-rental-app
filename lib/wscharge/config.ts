/**
 * WsCharge integration configuration (env-backed, validated at startup).
 */

export interface WsChargeConfig {
  enabled: boolean
  tcpPort: number
  tcpHost: string
  proxyUrl: string | null
  stationProxyToken: string | null
  commandTimeoutMs: number
  heartbeatStaleMs: number
}

let cached: WsChargeConfig | null = null

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : fallback
}

export function getWsChargeConfig(): WsChargeConfig {
  if (cached) return cached

  cached = {
    enabled: process.env.WSCHARGE_ENABLED !== 'false',
    tcpPort: parseIntEnv('TCP_PORT', 8088),
    tcpHost: process.env.TCP_HOST || '0.0.0.0',
    proxyUrl: process.env.TCP_PROXY_URL || null,
    stationProxyToken:
      process.env.STATION_PROXY_TOKEN || process.env.TCP_PROXY_API_KEY || null,
    commandTimeoutMs: parseIntEnv('WSCHARGE_COMMAND_TIMEOUT_MS', 30_000),
    heartbeatStaleMs: parseIntEnv('WSCHARGE_HEARTBEAT_STALE_MS', 120_000),
  }

  return cached
}

export function validateWsChargeConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const cfg = getWsChargeConfig()

  if (!cfg.enabled) {
    return { valid: true, errors: [] }
  }

  if (cfg.tcpPort < 1 || cfg.tcpPort > 65535) {
    errors.push('TCP_PORT must be between 1 and 65535')
  }

  if (process.env.NODE_ENV === 'production' && !cfg.stationProxyToken) {
    errors.push('STATION_PROXY_TOKEN or TCP_PROXY_API_KEY required in production')
  }

  return { valid: errors.length === 0, errors }
}
