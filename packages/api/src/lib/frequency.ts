import type { AdSurface } from "@distrotv/shared"
import { MAX_ADS_PER_HOUR_PER_SURFACE } from "@distrotv/shared"
import { getRedis } from "./redis.js"
import { logger } from "./logger.js"

// ── constants ───────────────────────────────────────────────────────────────

const HOURLY_TTL = 7_200 // 2 hours
const DAILY_TTL = 90_000 // 25 hours

// ── key helpers ─────────────────────────────────────────────────────────────

function utcDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function utcHour(): string {
  return String(new Date().getUTCHours()).padStart(2, "0")
}

function surfaceHourlyKey(deviceId: string, surface: AdSurface): string {
  return `freq:dev:${deviceId}:surface:${surface}:h:${utcDate()}:${utcHour()}`
}

function totalHourlyKey(deviceId: string): string {
  return `freq:dev:${deviceId}:total:h:${utcDate()}:${utcHour()}`
}

function totalDailyKey(deviceId: string): string {
  return `freq:dev:${deviceId}:total:d:${utcDate()}`
}

function campaignDailyKey(deviceId: string, campaignId: string): string {
  return `freq:dev:${deviceId}:campaign:${campaignId}:d:${utcDate()}`
}

// ── check frequency caps ────────────────────────────────────────────────────
// reads all relevant counters in a single pipeline round-trip.
// does NOT increment — that happens after impression is recorded.

export async function checkFrequencyCaps(
  deviceId: string,
  surface: AdSurface,
  maxPerHour: number,
  maxPerDay: number
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const redis = getRedis()
    const pipeline = redis.pipeline()
    pipeline.get(surfaceHourlyKey(deviceId, surface))
    pipeline.get(totalHourlyKey(deviceId))
    pipeline.get(totalDailyKey(deviceId))
    const results = await pipeline.exec()

    const surfaceHourly = Number(results[0]) || 0
    const totalHourly = Number(results[1]) || 0
    const totalDaily = Number(results[2]) || 0

    if (surfaceHourly >= MAX_ADS_PER_HOUR_PER_SURFACE) {
      return { allowed: false, reason: "surface_hourly_cap" }
    }
    if (totalHourly >= maxPerHour) {
      return { allowed: false, reason: "total_hourly_cap" }
    }
    if (totalDaily >= maxPerDay) {
      return { allowed: false, reason: "total_daily_cap" }
    }

    return { allowed: true }
  } catch (err) {
    logger.warn({ err, deviceId }, "checkFrequencyCaps redis error, failing open")
    return { allowed: true }
  }
}

// ── check per-campaign cap ──────────────────────────────────────────────────

export async function checkCampaignCap(
  deviceId: string,
  campaignId: string,
  maxImpressions: number
): Promise<boolean> {
  try {
    const redis = getRedis()
    const val = await redis.get(campaignDailyKey(deviceId, campaignId))
    const count = Number(val) || 0
    return count < maxImpressions
  } catch (err) {
    logger.warn({ err, deviceId, campaignId }, "checkCampaignCap redis error, failing open")
    return true
  }
}

// ── increment counters ──────────────────────────────────────────────────────
// called after impression is written to DB.

export async function incrementFrequency(
  deviceId: string,
  campaignId: string,
  surface: AdSurface
): Promise<void> {
  try {
    const redis = getRedis()
    const shk = surfaceHourlyKey(deviceId, surface)
    const thk = totalHourlyKey(deviceId)
    const tdk = totalDailyKey(deviceId)
    const cdk = campaignDailyKey(deviceId, campaignId)

    const pipeline = redis.pipeline()
    pipeline.incr(shk)
    pipeline.expire(shk, HOURLY_TTL)
    pipeline.incr(thk)
    pipeline.expire(thk, HOURLY_TTL)
    pipeline.incr(tdk)
    pipeline.expire(tdk, DAILY_TTL)
    pipeline.incr(cdk)
    pipeline.expire(cdk, DAILY_TTL)
    await pipeline.exec()
  } catch (err) {
    logger.warn({ err, deviceId, campaignId }, "incrementFrequency redis error")
  }
}

// ── quiet hours ─────────────────────────────────────────────────────────────
// tzOffsetMinutes converts UTC to user-local hour (e.g. UTC-5 = -300)

export function isQuietHours(start?: number, end?: number, tzOffsetMinutes = 0): boolean {
  if (start === undefined || end === undefined) return false
  const utcHourNow = new Date().getUTCHours()
  const utcMinNow = new Date().getUTCMinutes()
  const localMinutes = utcHourNow * 60 + utcMinNow + tzOffsetMinutes
  // normalize to 0-23 hour range (handles negative offsets and wrap-around)
  const localHour = ((Math.floor(localMinutes / 60) % 24) + 24) % 24
  // handles wrap-around (e.g. start=22, end=6 means 22-23 and 0-5)
  if (start <= end) {
    return localHour >= start && localHour < end
  }
  return localHour >= start || localHour < end
}
