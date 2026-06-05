/**
 * Rate limit storage — Upstash Redis REST when configured, else in-process memory.
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

const memoryStore = new Map<string, RateLimitEntry>()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of memoryStore) {
    if (entry.resetTime < now) memoryStore.delete(key)
  }
}, 60_000).unref()

async function upstashRequest(path: string): Promise<string | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  const res = await fetch(`${url}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(2000),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { result?: string | number }
  return data.result != null ? String(data.result) : null
}

/**
 * Increment counter with TTL (seconds). Returns new count or null if Upstash unavailable.
 */
async function upstashIncrWithExpire(key: string, windowSec: number): Promise<number | null> {
  const countStr = await upstashRequest(`/incr/${encodeURIComponent(key)}`)
  if (countStr === null) return null
  const count = parseInt(countStr, 10)
  if (count === 1) {
    await upstashRequest(`/expire/${encodeURIComponent(key)}/${windowSec}`)
  }
  return count
}

export async function incrementRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number,
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const windowSec = Math.ceil(windowMs / 1000)
  const distributed = await upstashIncrWithExpire(`rl:${key}`, windowSec)

  if (distributed !== null) {
    const allowed = distributed <= maxRequests
    const resetTime = Date.now() + windowMs
    return {
      allowed,
      remaining: Math.max(0, maxRequests - distributed),
      resetTime,
    }
  }

  const now = Date.now()
  const entry = memoryStore.get(key)

  if (!entry || entry.resetTime < now) {
    const newEntry: RateLimitEntry = { count: 1, resetTime: now + windowMs }
    memoryStore.set(key, newEntry)
    return { allowed: true, remaining: maxRequests - 1, resetTime: newEntry.resetTime }
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime }
  }

  entry.count += 1
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetTime: entry.resetTime,
  }
}
