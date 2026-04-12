interface Bucket {
  tokens: number
  lastRefill: number
}

export interface RateLimitConfig {
  maxTokens: number
  refillRate: number // tokens per second
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

const buckets = new Map<string, Bucket>()
let lastCleanup = Date.now()
const CLEANUP_INTERVAL_MS = 120_000

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now

  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > CLEANUP_INTERVAL_MS) {
      buckets.delete(key)
    }
  }
}

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  cleanup()

  const now = Date.now()
  let bucket = buckets.get(key)

  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefill: now }
    buckets.set(key, bucket)
  }

  const elapsed = (now - bucket.lastRefill) / 1000
  bucket.tokens = Math.min(config.maxTokens, bucket.tokens + elapsed * config.refillRate)
  bucket.lastRefill = now

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 }
  }

  const deficit = 1 - bucket.tokens
  const retryAfterMs = Math.ceil((deficit / config.refillRate) * 1000)

  return { allowed: false, remaining: 0, retryAfterMs }
}

export const RATE_LIMITS = {
  'coach': { maxTokens: 5, refillRate: 5 / 60 },
  'strategy': { maxTokens: 3, refillRate: 3 / 60 },
  'telegram': { maxTokens: 10, refillRate: 10 / 60 },
} as const satisfies Record<string, RateLimitConfig>

export type RateLimitKey = keyof typeof RATE_LIMITS
