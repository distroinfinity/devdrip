import { and, desc, eq, ne, or, sql } from "drizzle-orm"
import { REVENUE_SHARE_DEVELOPER } from "@distrotv/shared"
import { env } from "../config/env.js"
import { getDb } from "../db/index.js"
import { adImpressions as t } from "../db/schema/ad_impressions.js"

export function ctr(impressions: number, clicks: number): number {
  return impressions > 0 ? clicks / impressions : 0
}

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const v = Number.parseInt(String(raw ?? ""), 10)
  return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback
}
export const clampDays = (raw: unknown): number => clampInt(raw, 1, 90, 30)
export const clampLimit = (raw: unknown): number => clampInt(raw, 1, 100, 20)

function extractRows<T>(result: unknown): T[] {
  return ((result as { rows?: unknown[] }).rows ?? (result as unknown[])) as T[]
}

// all money here is an estimate: configurable cpm x developer share. day buckets
// are UTC; the cli shows the local-day total.
export async function getSummary(userId: string) {
  const [row] = await getDb()
    .select({
      today: sql<string>`coalesce(sum(${t.earnedAmount}) filter (where ${t.createdAt} >= date_trunc('day', now())), 0)`,
      last7d: sql<string>`coalesce(sum(${t.earnedAmount}) filter (where ${t.createdAt} >= now() - interval '7 days'), 0)`,
      allTime: sql<string>`coalesce(sum(${t.earnedAmount}), 0)`,
      served: sql<number>`count(*)::int`,
      impressions: sql<number>`(count(*) filter (where ${t.result} <> 'pending'))::int`,
      paidImpressions: sql<number>`(count(*) filter (where ${t.earnedAmount} > 0))::int`,
      clicks: sql<number>`(count(*) filter (where ${t.clicked}))::int`,
    })
    .from(t)
    .where(eq(t.userId, userId))
  const impressions = row?.impressions ?? 0
  const clicks = row?.clicks ?? 0
  return {
    today: Number(row?.today ?? 0),
    last7d: Number(row?.last7d ?? 0),
    allTime: Number(row?.allTime ?? 0),
    served: row?.served ?? 0,
    impressions,
    paidImpressions: row?.paidImpressions ?? 0,
    clicks,
    ctr: ctr(impressions, clicks),
    cpmRate: env.adCpmRate,
    revenueShare: REVENUE_SHARE_DEVELOPER,
    estimated: true as const,
  }
}

export async function getTimeseries(userId: string, days: number) {
  const raw = await getDb().execute(sql`
    select to_char(d.day, 'YYYY-MM-DD') as date,
           coalesce(sum(a.earned_amount), 0)::float8 as earned,
           (count(a.id) filter (where a.result <> 'pending'))::int as impressions,
           (count(a.id) filter (where a.clicked))::int as clicks
    from generate_series(
           date_trunc('day', now()) - (${days - 1} * interval '1 day'),
           date_trunc('day', now()),
           interval '1 day'
         ) as d(day)
    left join ad_impressions a
      on a.user_id = ${userId}
     and a.created_at >= d.day
     and a.created_at < d.day + interval '1 day'
    group by d.day
    order by d.day
  `)
  return extractRows<{ date: string; earned: number; impressions: number; clicks: number }>(
    raw
  ).map((r) => ({
    date: r.date,
    earned: Number(r.earned),
    impressions: Number(r.impressions),
    clicks: Number(r.clicks),
  }))
}

// ads the user actually saw or clicked — served-but-unseen deliveries stay out of the list
export async function getRecent(userId: string, limit: number) {
  const rows = await getDb()
    .select()
    .from(t)
    .where(and(eq(t.userId, userId), or(ne(t.result, "pending"), eq(t.clicked, true))))
    .orderBy(desc(t.createdAt))
    .limit(limit)
  return rows.map((r) => ({
    id: r.id,
    advertiser: r.advertiser,
    headline: r.headline,
    source: r.source,
    durationMs: r.durationMs,
    result: r.result,
    clicked: r.clicked,
    earned: Number(r.earnedAmount),
    createdAt: r.createdAt.toISOString(),
  }))
}
