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
export const clampLimit = (raw: unknown): number => clampInt(raw, 1, 100, 20)

// estimated earnings per hour of ad view time ("per agent-hour"). needs a few
// seconds of view time before it means anything.
const MIN_RATE_VIEW_MS = 10_000
export function ratePerHour(earned: number, viewMs: number): number {
  if (!Number.isFinite(earned) || !Number.isFinite(viewMs) || viewMs < MIN_RATE_VIEW_MS) return 0
  return earned / (viewMs / 3_600_000)
}

export type ChartRange = "1h" | "24h" | "30d"
const RANGES: Record<ChartRange, { step: "minute" | "hour" | "day"; points: number }> = {
  "1h": { step: "minute", points: 60 },
  "24h": { step: "hour", points: 24 },
  "30d": { step: "day", points: 30 },
}
export function parseRange(raw: unknown): { range: ChartRange } & (typeof RANGES)[ChartRange] {
  const range: ChartRange = raw === "1h" || raw === "24h" ? raw : "30d"
  return { range, ...RANGES[range] }
}

function extractRows<T>(result: unknown): T[] {
  return ((result as { rows?: unknown[] }).rows ?? (result as unknown[])) as T[]
}

// all money here is an estimate: configurable cpm x developer share. day buckets
// are UTC; the cli shows the local-day total.
export async function getSummary(userId: string) {
  const [row] = await getDb()
    .select({
      today: sql<string>`coalesce(sum(${t.earnedAmount}) filter (where coalesce(${t.seenAt}, ${t.createdAt}) >= date_trunc('day', now())), 0)`,
      last7d: sql<string>`coalesce(sum(${t.earnedAmount}) filter (where coalesce(${t.seenAt}, ${t.createdAt}) >= now() - interval '7 days'), 0)`,
      allTime: sql<string>`coalesce(sum(${t.earnedAmount}), 0)`,
      served: sql<number>`count(*)::int`,
      impressions: sql<number>`(count(*) filter (where ${t.result} <> 'pending'))::int`,
      paidImpressions: sql<number>`(count(*) filter (where ${t.earnedAmount} > 0))::int`,
      clicks: sql<number>`(count(*) filter (where ${t.clicked}))::int`,
      viewMs: sql<string>`coalesce(sum(${t.durationMs}) filter (where ${t.earnedAmount} > 0), 0)`,
      lastSeenAt: sql<
        string | null
      >`max(coalesce(${t.seenAt}, ${t.createdAt})) filter (where ${t.result} <> 'pending')`,
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
    // total time paid ads were on screen, and the estimated rate that implies
    viewMs: Number(row?.viewMs ?? 0),
    ratePerHour: ratePerHour(Number(row?.allTime ?? 0), Number(row?.viewMs ?? 0)),
    lastSeenAt: row?.lastSeenAt ? new Date(row.lastSeenAt).toISOString() : null,
    cpmRate: env.adCpmRate,
    revenueShare: REVENUE_SHARE_DEVELOPER,
    estimated: true as const,
  }
}

// bucketed earnings for the chart. `date` is the bucket start as an ISO timestamp (utc).
export async function getTimeseries(userId: string, rawRange: unknown) {
  const { range, step, points } = parseRange(rawRange)
  // step/points come from the fixed RANGES table above, never from the request
  const stepSql = sql.raw(`'${step}'`)
  const intervalSql = sql.raw(`interval '1 ${step}'`)
  const raw = await getDb().execute(sql`
    select to_char(b.ts at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date,
           coalesce(sum(a.earned_amount), 0)::float8 as earned,
           (count(a.id) filter (where a.result <> 'pending'))::int as impressions,
           (count(a.id) filter (where a.clicked))::int as clicks
    from generate_series(
           date_trunc(${stepSql}, now()) - (${points - 1} * ${intervalSql}),
           date_trunc(${stepSql}, now()),
           ${intervalSql}
         ) as b(ts)
    left join ad_impressions a
      on a.user_id = ${userId}
     and a.result <> 'pending'
     and coalesce(a.seen_at, a.created_at) >= b.ts
     and coalesce(a.seen_at, a.created_at) < b.ts + ${intervalSql}
    group by b.ts
    order by b.ts
  `)
  const rows = extractRows<{ date: string; earned: number; impressions: number; clicks: number }>(
    raw
  )
  return {
    range,
    points: rows.map((r) => ({
      date: r.date,
      earned: Number(r.earned),
      impressions: Number(r.impressions),
      clicks: Number(r.clicks),
    })),
  }
}

// ads the user actually saw or clicked — served-but-unseen deliveries stay out of the list
export async function getRecent(userId: string, limit: number) {
  const rows = await getDb()
    .select()
    .from(t)
    .where(and(eq(t.userId, userId), or(ne(t.result, "pending"), eq(t.clicked, true))))
    .orderBy(desc(sql`coalesce(${t.seenAt}, ${t.createdAt})`))
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
    // the moment it was seen, falling back to serve time for click-only rows
    createdAt: (r.seenAt ?? r.createdAt).toISOString(),
  }))
}
