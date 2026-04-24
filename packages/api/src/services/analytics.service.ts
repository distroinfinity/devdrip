import { eq, sql } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { devices } from "../db/schema/devices.js"
import { impressions } from "../db/schema/impressions.js"
import { clicks } from "../db/schema/clicks.js"
import { creatives } from "../db/schema/creatives.js"
import { preferences } from "../db/schema/preferences.js"
import type { AnalyticsFilters } from "../validators/analytics.validators.js"

export interface AnalyticsResponse {
  series: { date: string; impressions: number; completed: number; clicks: number; earned: number }[]
  totals: {
    impressions: number
    completed: number
    skipped: number
    expired: number
    interrupted: number
    clicks: number
    earned: number
    ctr: number
  }
  breakdowns: {
    bySource: { source: string; impressions: number; earned: number }[]
    byCategory: { category: string; impressions: number; earned: number }[]
    byResult: { result: string; impressions: number }[]
  }
}

export async function getUserImpressionAnalytics(
  userId: string,
  filters: AnalyticsFilters
): Promise<AnalyticsResponse> {
  const db = getDb()

  const [tzRow] = await db
    .select({ tz: preferences.tzOffsetMinutes })
    .from(preferences)
    .where(eq(preferences.userId, userId))
  const tzOffsetMinutes = tzRow?.tz ?? 0

  const devs = await db.select({ id: devices.id }).from(devices).where(eq(devices.userId, userId))
  const deviceIds = devs.map((d) => d.id)

  if (deviceIds.length === 0) return empty()

  // build base conds fresh per call site to avoid drizzle SQL fragment re-use issues
  function baseConds() {
    const conds = [
      sql`${impressions.deviceId} = any(${deviceIds})`,
      sql`${impressions.createdAt} >= ${filters.from}`,
      sql`${impressions.createdAt} <= ${filters.to}`,
    ]
    if (filters.source) conds.push(sql`${impressions.source} = ${filters.source}`)
    if (filters.result) conds.push(sql`${impressions.result} = ${filters.result}`)
    return conds
  }

  const tzInterval = sql.raw(`'${tzOffsetMinutes} minutes'`)
  const dayExpr = sql<string>`to_char(date_trunc('day', ${impressions.createdAt} + interval ${tzInterval}), 'YYYY-MM-DD')`

  const seriesConds = baseConds()
  const seriesWhere = sql.join(seriesConds, sql` and `)

  const seriesRows = await db
    .select({
      date: dayExpr,
      impressions: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where ${impressions.result} = 'completed')`,
      clicks: sql<number>`count(${clicks.id})`,
      earned: sql<number>`coalesce(sum(${impressions.earnedAmount}), 0)`,
    })
    .from(impressions)
    .leftJoin(clicks, eq(clicks.impressionId, impressions.id))
    .leftJoin(creatives, eq(creatives.id, impressions.creativeId))
    .where(
      filters.category
        ? sql`${seriesWhere} and ${creatives.category} = ${filters.category}`
        : seriesWhere
    )
    .groupBy(dayExpr)
    .orderBy(dayExpr)

  const totalsConds = baseConds()
  const totalsWhere = sql.join(totalsConds, sql` and `)

  const [totalsRow] = await db
    .select({
      impressions: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where ${impressions.result} = 'completed')`,
      skipped: sql<number>`count(*) filter (where ${impressions.result} = 'skipped')`,
      expired: sql<number>`count(*) filter (where ${impressions.result} = 'expired')`,
      interrupted: sql<number>`count(*) filter (where ${impressions.result} = 'interrupted')`,
      clicks: sql<number>`count(${clicks.id})`,
      earned: sql<number>`coalesce(sum(${impressions.earnedAmount}), 0)`,
    })
    .from(impressions)
    .leftJoin(clicks, eq(clicks.impressionId, impressions.id))
    .leftJoin(creatives, eq(creatives.id, impressions.creativeId))
    .where(
      filters.category
        ? sql`${totalsWhere} and ${creatives.category} = ${filters.category}`
        : totalsWhere
    )

  const sourceConds = baseConds()
  const sourceWhere = sql.join(sourceConds, sql` and `)

  const bySource = await db
    .select({
      source: impressions.source,
      impressions: sql<number>`count(*)`,
      earned: sql<number>`coalesce(sum(${impressions.earnedAmount}), 0)`,
    })
    .from(impressions)
    .leftJoin(creatives, eq(creatives.id, impressions.creativeId))
    .where(
      filters.category
        ? sql`${sourceWhere} and ${creatives.category} = ${filters.category}`
        : sourceWhere
    )
    .groupBy(impressions.source)

  const categoryConds = baseConds()
  const categoryWhere = sql.join(categoryConds, sql` and `)

  const byCategory = await db
    .select({
      category: creatives.category,
      impressions: sql<number>`count(*)`,
      earned: sql<number>`coalesce(sum(${impressions.earnedAmount}), 0)`,
    })
    .from(impressions)
    .innerJoin(creatives, eq(creatives.id, impressions.creativeId))
    .where(categoryWhere)
    .groupBy(creatives.category)

  const resultConds = baseConds()
  const resultWhere = sql.join(resultConds, sql` and `)

  const byResult = await db
    .select({
      result: impressions.result,
      impressions: sql<number>`count(*)`,
    })
    .from(impressions)
    .leftJoin(creatives, eq(creatives.id, impressions.creativeId))
    .where(
      filters.category
        ? sql`${resultWhere} and ${creatives.category} = ${filters.category}`
        : resultWhere
    )
    .groupBy(impressions.result)

  const completed = Number(totalsRow?.completed ?? 0)
  const ctr = completed > 0 ? Number(totalsRow?.clicks ?? 0) / completed : 0

  return {
    series: seriesRows.map((r) => ({
      date: r.date,
      impressions: Number(r.impressions),
      completed: Number(r.completed),
      clicks: Number(r.clicks),
      earned: Number(r.earned),
    })),
    totals: {
      impressions: Number(totalsRow?.impressions ?? 0),
      completed,
      skipped: Number(totalsRow?.skipped ?? 0),
      expired: Number(totalsRow?.expired ?? 0),
      interrupted: Number(totalsRow?.interrupted ?? 0),
      clicks: Number(totalsRow?.clicks ?? 0),
      earned: Number(totalsRow?.earned ?? 0),
      ctr,
    },
    breakdowns: {
      bySource: bySource.map((r) => ({
        source: r.source as string,
        impressions: Number(r.impressions),
        earned: Number(r.earned),
      })),
      byCategory: byCategory.map((r) => ({
        category: r.category as string,
        impressions: Number(r.impressions),
        earned: Number(r.earned),
      })),
      byResult: byResult.map((r) => ({
        result: r.result as string,
        impressions: Number(r.impressions),
      })),
    },
  }
}

function empty(): AnalyticsResponse {
  return {
    series: [],
    totals: {
      impressions: 0,
      completed: 0,
      skipped: 0,
      expired: 0,
      interrupted: 0,
      clicks: 0,
      earned: 0,
      ctr: 0,
    },
    breakdowns: { bySource: [], byCategory: [], byResult: [] },
  }
}
