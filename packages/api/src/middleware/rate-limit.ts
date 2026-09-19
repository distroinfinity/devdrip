import type { Request, Response, NextFunction } from "express"

const isTest = process.env.NODE_ENV === "test"

// In-memory fixed-window rate limiting. The API runs as a single Railway
// instance, so per-process counters are authoritative — and they cost zero
// Redis commands. Every request used to spend 2+ Upstash commands here (often
// stacked global+user), which silently drained the free-tier 500k/mo quota and
// took pairing down. Revisit only if we ever run multiple API instances.

type LimiterConfig = {
  requests: number
  window: `${number} s` | `${number} m` | `${number} h`
}

type LimitResult = {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

function windowMs(window: LimiterConfig["window"]): number {
  const [n, unit] = window.split(" ") as [string, "s" | "m" | "h"]
  const value = Number(n)
  const factor = unit === "h" ? 3_600_000 : unit === "m" ? 60_000 : 1_000
  return value * factor
}

type Bucket = { count: number; resetAt: number }

class MemoryLimiter {
  private buckets = new Map<string, Bucket>()
  private readonly windowMs: number

  constructor(
    private readonly requests: number,
    window: LimiterConfig["window"]
  ) {
    this.windowMs = windowMs(window)
  }

  limit(key: string): LimitResult {
    const now = Date.now()
    let bucket = this.buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      // roll the window; opportunistically prune to bound memory under churn
      if (this.buckets.size > 10_000) this.prune(now)
      bucket = { count: 0, resetAt: now + this.windowMs }
      this.buckets.set(key, bucket)
    }
    bucket.count += 1
    return {
      success: bucket.count <= this.requests,
      limit: this.requests,
      remaining: Math.max(0, this.requests - bucket.count),
      reset: bucket.resetAt,
    }
  }

  private prune(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key)
    }
  }
}

const limiterCache = new Map<string, MemoryLimiter>()

function getLimiter(name: string, config: LimiterConfig): MemoryLimiter {
  let limiter = limiterCache.get(name)
  if (!limiter) {
    limiter = new MemoryLimiter(config.requests, config.window)
    limiterCache.set(name, limiter)
  }
  return limiter
}

// ── key extractors ──────────────────────────────────────────────────────────

type KeyExtractor = (req: Request, res: Response) => string | null

function ipKey(req: Request): string {
  return req.ip ?? "unknown"
}

function userIdKey(_req: Request, res: Response): string | null {
  return (res.locals["userId"] as string | undefined) ?? null
}

// ── middleware factory ──────────────────────────────────────────────────────

function createLimiter(name: string, config: LimiterConfig, extractKey: KeyExtractor) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (isTest) return next()

    const key = extractKey(req, res)
    if (!key) return next()

    const limiter = getLimiter(name, config)
    const { success, limit, remaining, reset } = limiter.limit(key)

    res.setHeader("X-RateLimit-Limit", limit)
    res.setHeader("X-RateLimit-Remaining", remaining)
    res.setHeader("X-RateLimit-Reset", Math.floor(reset / 1000))

    if (!success) {
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
      res.setHeader("Retry-After", retryAfter)
      await res.status(429).json({ error: "rate_limit_exceeded", tier: name, retryAfter })
      return
    }

    next()
  }
}

// ── exported limiters ───────────────────────────────────────────────────────

export const globalLimiter = createLimiter(
  "global",
  { requests: 100, window: "60 s" },
  (req) => `ip:${ipKey(req)}`
)

export const publicLimiter = createLimiter(
  "public",
  { requests: 20, window: "60 s" },
  (req) => `ip:${ipKey(req)}`
)

// applied to POST /devices (re-registration) and any per-ip-throttled auth endpoint
export const authLimiter = createLimiter(
  "auth",
  { requests: 10, window: "60 s" },
  (req) => `ip:${ipKey(req)}`
)

// reserved; currently no callers post github-oauth cutover
export const refreshLimiter = createLimiter(
  "refresh",
  { requests: 20, window: "60 s" },
  (req) => `ip:${ipKey(req)}`
)

export const userLimiter = createLimiter("user", { requests: 60, window: "60 s" }, (_req, res) => {
  const id = userIdKey(_req, res)
  return id ? `uid:${id}` : null
})

export const sensitiveLimiter = createLimiter(
  "sensitive",
  { requests: 3, window: "1 h" },
  (_req, res) => {
    const id = userIdKey(_req, res)
    return id ? `uid:${id}` : null
  }
)

export const adminLimiter = createLimiter(
  "admin",
  { requests: 30, window: "60 s" },
  (req) => `ip:${ipKey(req)}`
)

export const machineLimiter = createLimiter(
  "machine",
  { requests: 300, window: "60 s" },
  (_req, res) => {
    const deviceId = res.locals["deviceId"] as string | undefined
    return deviceId ? `dev:${deviceId}` : null
  }
)
