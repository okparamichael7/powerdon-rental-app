/**
 * In-process WsCharge protocol metrics (alert-ready counters).
 */

type CounterMap = Record<string, number>

const counters: CounterMap = {
  connections_login_success: 0,
  connections_login_failure: 0,
  messages_received: 0,
  messages_sent: 0,
  validation_failures: 0,
  handler_failures: 0,
  checksum_failures: 0,
  token_failures: 0,
  idempotent_skips: 0,
}

const latencySamples: number[] = []
const MAX_SAMPLES = 200

export function incrementWsChargeMetric(name: keyof typeof counters, delta = 1): void {
  counters[name] = (counters[name] ?? 0) + delta
}

export function recordWsChargeLatency(ms: number): void {
  latencySamples.push(ms)
  if (latencySamples.length > MAX_SAMPLES) latencySamples.shift()
}

export function getWsChargeMetrics(): {
  counters: CounterMap
  latencyMs: { p50: number; p95: number; samples: number }
} {
  const sorted = [...latencySamples].sort((a, b) => a - b)
  const p50 = sorted.length ? sorted[Math.floor(sorted.length * 0.5)] : 0
  const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0
  return {
    counters: { ...counters },
    latencyMs: { p50, p95, samples: sorted.length },
  }
}

export function resetWsChargeMetricsForTests(): void {
  for (const key of Object.keys(counters)) counters[key] = 0
  latencySamples.length = 0
}
