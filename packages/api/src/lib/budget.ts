import { getRedis } from "./redis.js"
import { logger } from "./logger.js"

// ── types ───────────────────────────────────────────────────────────────────

export type SpendResult =
  | { allowed: true; exhausted: false }
  | { allowed: true; exhausted: true }
  | { allowed: false; reason: "daily_cap" | "hourly_cap" | "total_budget" }

type CampaignBudget = {
  budgetTotal: number
  budgetSpent: number
  budgetDaily: number
  pacingStrategy: "even" | "front_loaded" | "asap"
}

// ── constants ───────────────────────────────────────────────────────────────

const DAILY_TTL = 90_000 // 25 hours
const HOURLY_TTL = 7_200 // 2 hours

// front-loaded weight curve: hours 0-7 = 1.5x, 8-15 = 1.0x, 16-23 = 0.5x
// normalized so sum of 24 weights = 24 (making average weight = 1.0)
const FRONT_LOADED_WEIGHTS: number[] = Array.from({ length: 24 }, (_, h) => {
  if (h < 8) return 1.5
  if (h < 16) return 1.0
  return 0.5
})

// ── key helpers ─────────────────────────────────────────────────────────────

function utcDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function utcHour(): string {
  return String(new Date().getUTCHours()).padStart(2, "0")
}

function dailyKey(campaignId: string, date?: string): string {
  return `budget:daily:${campaignId}:${date ?? utcDate()}`
}

function hourlyKey(campaignId: string, date?: string, hour?: string): string {
  return `budget:hourly:${campaignId}:${date ?? utcDate()}:${hour ?? utcHour()}`
}

function rotationKey(campaignId: string): string {
  return `budget:rotation:${campaignId}`
}

// ── pacing ──────────────────────────────────────────────────────────────────

export function hourlyCapForStrategy(
  budgetDaily: number,
  strategy: "even" | "front_loaded" | "asap",
  hourIndex: number
): number {
  if (strategy === "asap") return budgetDaily // no hourly cap, full daily budget is the ceiling
  if (strategy === "even") return budgetDaily / 24
  // front_loaded
  const weight = FRONT_LOADED_WEIGHTS[hourIndex] ?? 1.0
  return (budgetDaily / 24) * weight
}

// ── record spend ────────────────────────────────────────────────────────────

export async function recordSpend(
  campaignId: string,
  cost: number,
  campaign: CampaignBudget
): Promise<SpendResult> {
  // pre-check: total budget guard (avoids Redis I/O for exhausted campaigns)
  if (campaign.budgetSpent + cost > campaign.budgetTotal) {
    return { allowed: false, reason: "total_budget" }
  }

  const redis = getRedis()
  const dk = dailyKey(campaignId)
  const hk = hourlyKey(campaignId)
  const hourIndex = new Date().getUTCHours()
  const hourlyCap = hourlyCapForStrategy(campaign.budgetDaily, campaign.pacingStrategy, hourIndex)

  try {
    // pipeline: increment + set TTL atomically
    const pipeline = redis.pipeline()
    pipeline.incrbyfloat(dk, cost)
    pipeline.expire(dk, DAILY_TTL)
    pipeline.incrbyfloat(hk, cost)
    pipeline.expire(hk, HOURLY_TTL)
    const results = await pipeline.exec()

    const newDailySpend = parseFloat(String(results[0]))
    const newHourlySpend = parseFloat(String(results[2]))

    // check hourly cap (only for even/front_loaded)
    if (campaign.pacingStrategy !== "asap" && newHourlySpend > hourlyCap) {
      // rollback
      const rb = redis.pipeline()
      rb.incrbyfloat(dk, -cost)
      rb.incrbyfloat(hk, -cost)
      await rb.exec()
      return { allowed: false, reason: "hourly_cap" }
    }

    // check daily cap
    if (newDailySpend > campaign.budgetDaily) {
      // rollback
      const rb = redis.pipeline()
      rb.incrbyfloat(dk, -cost)
      rb.incrbyfloat(hk, -cost)
      await rb.exec()
      return { allowed: false, reason: "daily_cap" }
    }

    // check if budget is now exhausted (total spend approaching limit)
    const newTotalSpent = campaign.budgetSpent + newDailySpend
    const exhausted = newTotalSpent >= campaign.budgetTotal || newDailySpend >= campaign.budgetDaily

    return { allowed: true, exhausted }
  } catch (err) {
    logger.error({ err, campaignId }, "budget recordSpend redis error, failing open")
    // fail open — allow the impression rather than blocking revenue
    return { allowed: true, exhausted: false }
  }
}

// ── read helpers ────────────────────────────────────────────────────────────

export async function getDailySpend(campaignId: string, date?: string): Promise<number> {
  try {
    const redis = getRedis()
    const val = await redis.get(dailyKey(campaignId, date))
    return val ? parseFloat(String(val)) : 0
  } catch (err) {
    logger.warn({ err, campaignId }, "getDailySpend redis error")
    return 0
  }
}

export async function getHourlySpend(
  campaignId: string,
  date?: string,
  hour?: string
): Promise<number> {
  try {
    const redis = getRedis()
    const val = await redis.get(hourlyKey(campaignId, date, hour))
    return val ? parseFloat(String(val)) : 0
  } catch (err) {
    logger.warn({ err, campaignId }, "getHourlySpend redis error")
    return 0
  }
}

// ── creative rotation ───────────────────────────────────────────────────────

export async function nextCreativeIndex(campaignId: string): Promise<number> {
  try {
    const redis = getRedis()
    const val = await redis.incr(rotationKey(campaignId))
    return val - 1 // incr returns value after increment, we want the pre-increment index
  } catch (err) {
    logger.warn({ err, campaignId }, "nextCreativeIndex redis error, returning 0")
    return 0
  }
}
