import { sql, count, eq, gte } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { impressions } from "../db/schema/impressions.js"
import { earningsLedger } from "../db/schema/earnings.js"
import { campaigns } from "../db/schema/campaigns.js"
import type { AdminStats, AdminStatsBlock } from "@devdrip/shared"

// today = since start of current UTC day; admin ops are a single global clock
function startOfUtcDay(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

async function aggregate(sinceInclusive: Date | null): Promise<AdminStatsBlock> {
  const db = getDb()

  const impressionsWhere = sinceInclusive ? gte(impressions.createdAt, sinceInclusive) : undefined
  const earningsWhere = sinceInclusive ? gte(earningsLedger.createdAt, sinceInclusive) : undefined

  const [impressionsAgg, earningsAgg] = await Promise.all([
    db
      .select({
        count: count(),
        spend: sql<number>`coalesce(sum(${impressions.earnedAmount}), 0)::float`,
      })
      .from(impressions)
      .where(impressionsWhere),
    db
      .select({
        earnings: sql<number>`coalesce(sum(${earningsLedger.amountUsdc}), 0)::float`,
      })
      .from(earningsLedger)
      .where(earningsWhere),
  ])

  return {
    impressionsCount: impressionsAgg[0]?.count ?? 0,
    spendUsdc: impressionsAgg[0]?.spend ?? 0,
    earningsUsdc: earningsAgg[0]?.earnings ?? 0,
  }
}

export async function getStats(): Promise<AdminStats> {
  const db = getDb()
  const [today, lifetime, [activeCampaignsRow]] = await Promise.all([
    aggregate(startOfUtcDay()),
    aggregate(null),
    db.select({ count: count() }).from(campaigns).where(eq(campaigns.status, "active")),
  ])
  return {
    today,
    lifetime,
    activeCampaignsCount: activeCampaignsRow?.count ?? 0,
  }
}
