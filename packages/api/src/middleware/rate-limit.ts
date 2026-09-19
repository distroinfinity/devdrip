import { Ratelimit } from "@upstash/ratelimit"
import type { Request, Response, NextFunction } from "express"
import { getRedis } from "../lib/redis.js"
import { logger } from "../lib/logger.js"

// cache ratelimit instances per tier
const limiterCache = new Map<string, Ratelimit>()

type LimiterConfig = {
  requests: number
  window: `${number} s` | `${number} m` | `${number} h`
}

function getLimiter(name: string, config: LimiterConfig): Ratelimit {
  let limiter = limiterCache.get(name)
  if (!limiter) {
    limiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(config.requests, config.window),
      prefix: `rl:${name}`,
    })
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
    const key = extractKey(req, res)
    if (!key) return next()

    try {
      const limiter = getLimiter(name, config)
      const { success, limit, remaining, reset } = await limiter.limit(key)

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
    } catch (err) {
      logger.warn({ err, tier: name }, "redis error, failing open")
      next()
    }
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

export const authLimiter = createLimiter(
  "auth",
  { requests: 10, window: "60 s" },
  (req) => `ip:${ipKey(req)}`
)

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

export const advertiserLimiter = createLimiter(
  "advertiser",
  { requests: 30, window: "60 s" },
  (_req, res) => {
    const id = userIdKey(_req, res)
    return id ? `uid:${id}` : null
  }
)
