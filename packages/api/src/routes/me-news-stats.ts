import { Router } from "express"
import { countNewsImpressionsLastNDays } from "../services/reading.service.js"

export const meNewsStatsRouter: ReturnType<typeof Router> = Router()

// 60s server-side cache — matches the existing earnings-summary cache pattern.
// in-memory map keyed by userId. small enough for v1; if user count grows we
// can swap to redis the same way earnings.service.ts did.
const CACHE_TTL_MS = 60_000

interface CacheEntry {
  value: { thisWeek: number; lastWeek: number }
  at: number
}

const cache = new Map<string, CacheEntry>()

meNewsStatsRouter.get("/", async (_req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const cached = cache.get(userId)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      res.json(cached.value)
      return
    }

    // last 7 days vs the 7 days before that. derive lastWeek as
    // (last 14 days count) - (last 7 days count) — one less query.
    const [thisWeek, lastTwoWeeks] = await Promise.all([
      countNewsImpressionsLastNDays(userId, 7),
      countNewsImpressionsLastNDays(userId, 14),
    ])
    const lastWeek = Math.max(0, lastTwoWeeks - thisWeek)
    const value = { thisWeek, lastWeek }
    cache.set(userId, { value, at: Date.now() })
    res.json(value)
  } catch (err) {
    next(err)
  }
})
