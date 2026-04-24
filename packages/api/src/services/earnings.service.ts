import { desc, eq, inArray, sql } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { devices } from "../db/schema/devices.js"
import { impressions } from "../db/schema/impressions.js"
import { clicks } from "../db/schema/clicks.js"
import { earningsLedger } from "../db/schema/earnings.js"
import { payouts } from "../db/schema/payouts.js"
import { preferences } from "../db/schema/preferences.js"
import { getRedis } from "../lib/redis.js"
import { logger } from "../lib/logger.js"

const CACHE_TTL_SECONDS = 60

export interface EarningsSummary {
  balance: number
  today: number
  week: number
  month: number
  allTime: number
  streakDays: number
  totalImpressions: number
  totalClicks: number
  topCategories: { category: string; amountUsdc: number }[]
}

function key(userId: string): string {
  return `earnings:summary:${userId}`
}

export async function invalidateEarningsSummary(userId: string): Promise<void> {
  try {
    await getRedis().del(key(userId))
  } catch (err) {
    logger.warn({ err, userId }, "earnings summary invalidate failed")
  }
}

export async function getEarningsSummary(userId: string): Promise<EarningsSummary> {
  const cached = await safeGet(userId)
  if (cached) return cached

  const fresh = await computeSummary(userId)
  await safeSet(userId, fresh)
  return fresh
}

async function safeGet(userId: string): Promise<EarningsSummary | null> {
  try {
    const raw = await getRedis().get<string>(key(userId))
    return raw ? (JSON.parse(raw) as EarningsSummary) : null
  } catch {
    return null
  }
}

async function safeSet(userId: string, value: EarningsSummary): Promise<void> {
  try {
    await getRedis().set(key(userId), JSON.stringify(value), { ex: CACHE_TTL_SECONDS })
  } catch {
    // cache miss on failure is fine
  }
}

async function computeSummary(userId: string): Promise<EarningsSummary> {
  const db = getDb()

  const [tzRow] = await db
    .select({ tz: preferences.tzOffsetMinutes })
    .from(preferences)
    .where(eq(preferences.userId, userId))
  const tzOffsetMinutes = tzRow?.tz ?? 0

  const nowShifted = sql<Date>`(now() + interval ${sql.raw(`'${tzOffsetMinutes} minutes'`)})`

  const [agg] = await db
    .select({
      allTime: sql<number>`coalesce(sum(${earningsLedger.amountUsdc}), 0)`,
      today: sql<number>`coalesce(sum(${earningsLedger.amountUsdc}) filter (
        where date_trunc('day', ${earningsLedger.createdAt} + interval ${sql.raw(`'${tzOffsetMinutes} minutes'`)})
            = date_trunc('day', ${nowShifted})
      ), 0)`,
      week: sql<number>`coalesce(sum(${earningsLedger.amountUsdc}) filter (
        where date_trunc('week', ${earningsLedger.createdAt} + interval ${sql.raw(`'${tzOffsetMinutes} minutes'`)})
            = date_trunc('week', ${nowShifted})
      ), 0)`,
      month: sql<number>`coalesce(sum(${earningsLedger.amountUsdc}) filter (
        where date_trunc('month', ${earningsLedger.createdAt} + interval ${sql.raw(`'${tzOffsetMinutes} minutes'`)})
            = date_trunc('month', ${nowShifted})
      ), 0)`,
    })
    .from(earningsLedger)
    .where(eq(earningsLedger.userId, userId))

  const [paid] = await db
    .select({
      total: sql<number>`coalesce(sum(${payouts.amountUsdc}) filter (where ${payouts.status} = 'confirmed'), 0)`,
    })
    .from(payouts)
    .where(eq(payouts.userId, userId))

  const userDevices = await db
    .select({ id: devices.id })
    .from(devices)
    .where(eq(devices.userId, userId))
  const deviceIds = userDevices.map((d) => d.id)

  let totalImpressions = 0
  let totalClicks = 0
  if (deviceIds.length > 0) {
    const [impAgg] = await db
      .select({ n: sql<number>`count(*)` })
      .from(impressions)
      .where(inArray(impressions.deviceId, deviceIds))
    totalImpressions = Number(impAgg?.n ?? 0)

    const [clkAgg] = await db
      .select({ n: sql<number>`count(${clicks.id})` })
      .from(clicks)
      .innerJoin(impressions, eq(clicks.impressionId, impressions.id))
      .where(inArray(impressions.deviceId, deviceIds))
    totalClicks = Number(clkAgg?.n ?? 0)
  }

  const topRows = await db
    .select({
      category: earningsLedger.adCategory,
      amountUsdc: sql<number>`coalesce(sum(${earningsLedger.amountUsdc}), 0)`,
    })
    .from(earningsLedger)
    .where(eq(earningsLedger.userId, userId))
    .groupBy(earningsLedger.adCategory)
    .orderBy(desc(sql`coalesce(sum(${earningsLedger.amountUsdc}), 0)`))
    .limit(3)

  let streakDays = 0
  if (deviceIds.length > 0) {
    // raw SQL needed for the distinct-day streak computation with tz offset
    const streakResult = await db.execute<{ day: string }>(sql`
      select distinct date_trunc('day', ${impressions.createdAt} + interval ${sql.raw(`'${tzOffsetMinutes} minutes'`)})::date as day
      from ${impressions}
      where ${inArray(impressions.deviceId, deviceIds)}
        and ${impressions.result} = 'completed'
      order by day desc
      limit 400
    `)
    // neon-http returns { rows: T[] }; postgres-js returns an array-like RowList
    const rows: { day: string }[] =
      "rows" in streakResult
        ? (streakResult as { rows: { day: string }[] }).rows
        : (streakResult as unknown as { day: string }[])
    streakDays = countStreak(
      rows.map((r) => String(r.day).slice(0, 10)),
      nowLocalDay(tzOffsetMinutes)
    )
  }

  const allTime = Number(agg?.allTime ?? 0)
  const balance = allTime - Number(paid?.total ?? 0)

  return {
    balance,
    today: Number(agg?.today ?? 0),
    week: Number(agg?.week ?? 0),
    month: Number(agg?.month ?? 0),
    allTime,
    streakDays,
    totalImpressions,
    totalClicks,
    topCategories: topRows.map((r) => ({
      category: r.category as string,
      amountUsdc: Number(r.amountUsdc),
    })),
  }
}

function nowLocalDay(tzOffsetMinutes: number): string {
  const now = new Date(Date.now() + tzOffsetMinutes * 60_000)
  return now.toISOString().slice(0, 10)
}

function countStreak(days: string[], today: string): number {
  if (days.length === 0) return 0
  const dayMs = 86_400_000
  let cursor = new Date(today + "T00:00:00Z").getTime()
  const set = new Set(days)
  let n = 0
  while (set.has(new Date(cursor).toISOString().slice(0, 10))) {
    n += 1
    cursor -= dayMs
  }
  return n
}
