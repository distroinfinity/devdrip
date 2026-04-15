import { and, eq, sql } from "drizzle-orm"
import type { ImpressionResult, AdSurface, AdSource } from "@devdrip/shared"
import { REVENUE_SHARE_DEVELOPER } from "@devdrip/shared"
import { getDb } from "../db/index.js"
import { creatives } from "../db/schema/creatives.js"
import { campaigns } from "../db/schema/campaigns.js"
import { impressions } from "../db/schema/impressions.js"
import { clicks } from "../db/schema/clicks.js"
import { earningsLedger } from "../db/schema/earnings.js"
import { NotFoundError, ConflictError, StateError, pgErrorCode } from "../errors/index.js"
import { recordSpend, rollbackSpend } from "../lib/budget.js"
import { incrementFrequency } from "../lib/frequency.js"
import { transitionStatus } from "./campaign.service.js"
import { logger } from "../lib/logger.js"

// ── types ───────────────────────────────────────────────────────────────────

export interface RecordImpressionInput {
  creativeId: string
  deviceId: string
  userId: string
  surface: AdSurface
  durationMs: number
  result: ImpressionResult
}

// ── record impression ───────────────────────────────────────────────────────

export async function recordImpression(input: RecordImpressionInput) {
  const db = getDb()
  const now = new Date()

  // fetch the creative only if it is still eligible to be served
  const [row] = await db
    .select({
      creativeId: creatives.id,
      campaignId: creatives.campaignId,
      source: creatives.source,
      surface: creatives.surface,
      category: creatives.category,
      cpmRate: creatives.cpmRate,
      budgetTotal: campaigns.budgetTotal,
      budgetSpent: campaigns.budgetSpent,
      budgetDaily: campaigns.budgetDaily,
      pacingStrategy: campaigns.pacingStrategy,
    })
    .from(creatives)
    .innerJoin(campaigns, eq(creatives.campaignId, campaigns.id))
    .where(
      and(
        eq(creatives.id, input.creativeId),
        eq(creatives.isActive, true),
        eq(creatives.surface, input.surface),
        eq(campaigns.status, "active"),
        sql`(${campaigns.startsAt} IS NULL OR ${campaigns.startsAt} <= ${now})`,
        sql`(${campaigns.endsAt} IS NULL OR ${campaigns.endsAt} > ${now})`
      )
    )

  if (!row) throw new StateError("creative_not_servable")

  // calculate earnings
  const costPerImpression = row.cpmRate / 1000
  const earnedAmount =
    input.result === "completed" ? costPerImpression * REVENUE_SHARE_DEVELOPER : 0

  // record spend in Redis (fail-open)
  const spendResult = await recordSpend(row.campaignId, costPerImpression, {
    budgetTotal: row.budgetTotal,
    budgetSpent: row.budgetSpent,
    budgetDaily: row.budgetDaily,
    pacingStrategy: row.pacingStrategy as "even" | "front_loaded" | "asap",
  })

  if (!spendResult.allowed) {
    throw new StateError("campaign_budget_exhausted", { reason: spendResult.reason })
  }

  // DB transaction: insert impression + earnings
  let impression
  try {
    impression = await db.transaction(async (tx) => {
      const [imp] = await tx
        .insert(impressions)
        .values({
          creativeId: input.creativeId,
          deviceId: input.deviceId,
          source: row.source as AdSource,
          surface: row.surface as AdSurface,
          durationMs: input.durationMs,
          result: input.result,
          cpmRate: row.cpmRate,
          earnedAmount,
        })
        .returning()

      if (!imp) throw new Error("impression insert returned no rows")

      // only create earnings for completed impressions
      if (input.result === "completed" && earnedAmount > 0) {
        await tx.insert(earningsLedger).values({
          userId: input.userId,
          impressionId: imp.id,
          amountUsdc: earnedAmount,
          surface: row.surface as AdSurface,
          adCategory: row.category as (typeof earningsLedger)["$inferInsert"]["adCategory"],
        })
      }

      return imp
    })
  } catch (err) {
    await rollbackSpend(row.campaignId, costPerImpression)
    throw err
  }

  // fire-and-forget: increment frequency counters
  incrementFrequency(input.deviceId, row.campaignId, row.surface as AdSurface).catch((err) => {
    logger.warn({ err, deviceId: input.deviceId }, "incrementFrequency failed")
  })

  // fire-and-forget: transition campaign to completed if budget exhausted
  if (spendResult.allowed && "exhausted" in spendResult && spendResult.exhausted) {
    transitionStatus(row.campaignId, "completed").catch((err) => {
      logger.warn({ err, campaignId: row.campaignId }, "auto-complete campaign failed")
    })
  }

  return impression
}

// ── record click ────────────────────────────────────────────────────────────

export async function recordClick(impressionId: string) {
  const db = getDb()

  // verify impression exists
  const [imp] = await db
    .select({ id: impressions.id })
    .from(impressions)
    .where(eq(impressions.id, impressionId))
  if (!imp) throw new NotFoundError("impression")

  try {
    const [click] = await db.insert(clicks).values({ impressionId }).returning()
    if (!click) throw new Error("click insert returned no rows")
    return { clickId: click.id }
  } catch (err) {
    // unique constraint on impression_id prevents double-clicks
    if (pgErrorCode(err) === "23505") {
      throw new ConflictError("click_already_recorded")
    }
    throw err
  }
}
