import { eq, sql } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { impressions } from "../db/schema/impressions.js"
import { clicks } from "../db/schema/clicks.js"
import { campaigns } from "../db/schema/campaigns.js"
import { advertisers } from "../db/schema/advertisers.js"
import { NotFoundError } from "../errors/index.js"

export type PacingStatus = "underpacing" | "on_track" | "overpacing" | "unknown"

export interface PacingInfo {
  status: PacingStatus
  ratio: number | null
}

export interface CampaignReportRow {
  campaignId: string
  name: string
  advertiserId: string
  advertiserName: string
  source: string
  impressions: number
  completed: number
  clicks: number
  ctr: number
  spend: number
  budgetTotal: number
  remaining: number
  pacing: PacingInfo
}

export interface CampaignReportFilters {
  status?: string
  from?: Date
  to?: Date
  source?: string
}

const SYNTHETIC_DURATION_MS = 30 * 86_400_000

export function computePacing(params: {
  createdAt: Date
  startsAt: Date | null
  endsAt: Date | null
  budgetTotal: number
  actualSpend: number
  now?: Date
}): PacingInfo {
  if (params.budgetTotal <= 0) return { status: "unknown", ratio: null }
  const now = params.now ?? new Date()
  const start = (params.startsAt ?? params.createdAt).getTime()
  const end = (params.endsAt ?? new Date(start + SYNTHETIC_DURATION_MS)).getTime()
  if (end <= start) return { status: "unknown", ratio: null }
  const elapsed = Math.max(0, Math.min(now.getTime(), end) - start)
  const fraction = elapsed / (end - start)
  const expected = params.budgetTotal * fraction
  if (expected <= 0) return { status: "unknown", ratio: null }
  const ratio = params.actualSpend / expected
  let status: PacingStatus
  if (ratio < 0.85) status = "underpacing"
  else if (ratio > 1.15) status = "overpacing"
  else status = "on_track"
  return { status, ratio }
}

export async function listCampaignReports(
  filters: CampaignReportFilters = {}
): Promise<CampaignReportRow[]> {
  const db = getDb()
  const conds: ReturnType<typeof sql>[] = []
  if (filters.status) conds.push(sql`${campaigns.status} = ${filters.status}`)
  const campaignWhere = conds.length ? sql.join(conds, sql` and `) : sql`true`

  const campaignRows = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      advertiserId: campaigns.advertiserId,
      advertiserName: advertisers.name,
      budgetTotal: campaigns.budgetTotal,
      startsAt: campaigns.startsAt,
      endsAt: campaigns.endsAt,
      createdAt: campaigns.createdAt,
    })
    .from(campaigns)
    .innerJoin(advertisers, eq(advertisers.id, campaigns.advertiserId))
    .where(campaignWhere)

  const results: CampaignReportRow[] = []
  for (const c of campaignRows) {
    const metricConds: ReturnType<typeof sql>[] = [
      sql`${impressions.creativeId} in (
        select id from creatives where campaign_id = ${c.id}
      )`,
    ]
    if (filters.from)
      metricConds.push(sql`${impressions.createdAt} >= ${filters.from.toISOString()}`)
    if (filters.to) metricConds.push(sql`${impressions.createdAt} <= ${filters.to.toISOString()}`)
    if (filters.source) metricConds.push(sql`${impressions.source} = ${filters.source}`)
    const where = sql.join(metricConds, sql` and `)

    const [agg] = await db
      .select({
        impressions: sql<number>`count(*)`,
        completed: sql<number>`count(*) filter (where ${impressions.result} = 'completed')`,
        clicks: sql<number>`count(${clicks.id})`,
        spend: sql<number>`coalesce(sum(${impressions.cpmRate} / 1000), 0)`,
        source: sql<string>`coalesce(max(${impressions.source}::text), '')`,
      })
      .from(impressions)
      .leftJoin(clicks, eq(clicks.impressionId, impressions.id))
      .where(where)

    const completed = Number(agg?.completed ?? 0)
    const clicksN = Number(agg?.clicks ?? 0)
    const spend = Number(agg?.spend ?? 0)

    results.push({
      campaignId: c.id,
      name: c.name,
      advertiserId: c.advertiserId,
      advertiserName: c.advertiserName,
      source: agg?.source ?? "",
      impressions: Number(agg?.impressions ?? 0),
      completed,
      clicks: clicksN,
      ctr: completed > 0 ? clicksN / completed : 0,
      spend,
      budgetTotal: Number(c.budgetTotal),
      remaining: Math.max(0, Number(c.budgetTotal) - spend),
      pacing: computePacing({
        createdAt: c.createdAt,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        budgetTotal: Number(c.budgetTotal),
        actualSpend: spend,
      }),
    })
  }
  return results
}

export async function getCampaignReport(campaignId: string): Promise<{
  campaign: CampaignReportRow
  series: { date: string; impressions: number; clicks: number; spend: number }[]
}> {
  const all = await listCampaignReports()
  const [row] = all.filter((r) => r.campaignId === campaignId)
  if (!row) throw new NotFoundError("campaign")

  const db = getDb()
  const dayExpr = sql<string>`to_char(date_trunc('day', ${impressions.createdAt}), 'YYYY-MM-DD')`
  const series = await db
    .select({
      date: dayExpr,
      impressions: sql<number>`count(*)`,
      clicks: sql<number>`count(${clicks.id})`,
      spend: sql<number>`coalesce(sum(${impressions.cpmRate} / 1000), 0)`,
    })
    .from(impressions)
    .leftJoin(clicks, eq(clicks.impressionId, impressions.id))
    .where(
      sql`${impressions.creativeId} in (select id from creatives where campaign_id = ${campaignId})`
    )
    .groupBy(dayExpr)
    .orderBy(dayExpr)

  return {
    campaign: row,
    series: series.map((s) => ({
      date: s.date,
      impressions: Number(s.impressions),
      clicks: Number(s.clicks),
      spend: Number(s.spend),
    })),
  }
}

export async function getAdvertiserReport(advertiserId: string): Promise<{
  advertiser: { id: string; name: string }
  totals: { impressions: number; clicks: number; ctr: number; spend: number; budgetTotal: number }
  campaigns: CampaignReportRow[]
}> {
  const db = getDb()
  const [adv] = await db
    .select({ id: advertisers.id, name: advertisers.name })
    .from(advertisers)
    .where(eq(advertisers.id, advertiserId))
  if (!adv) throw new NotFoundError("advertiser")

  const all = await listCampaignReports()
  const mine = all.filter((r) => r.advertiserId === advertiserId)

  const impressionsN = mine.reduce((s, r) => s + r.impressions, 0)
  const clicksN = mine.reduce((s, r) => s + r.clicks, 0)
  const spend = mine.reduce((s, r) => s + r.spend, 0)
  const budgetTotal = mine.reduce((s, r) => s + r.budgetTotal, 0)
  const completed = mine.reduce((s, r) => s + r.completed, 0)

  return {
    advertiser: { id: adv.id, name: adv.name },
    totals: {
      impressions: impressionsN,
      clicks: clicksN,
      ctr: completed > 0 ? clicksN / completed : 0,
      spend,
      budgetTotal,
    },
    campaigns: mine,
  }
}
