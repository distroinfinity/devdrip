import { and, eq, sql } from "drizzle-orm"
import type { ImpressionResult, AdSurface, AdSource } from "@devdrip/shared"
import { REVENUE_SHARE_DEVELOPER } from "@devdrip/shared"
import { getDb } from "../db/index.js"
import { creatives } from "../db/schema/creatives.js"
import { campaigns } from "../db/schema/campaigns.js"
import { impressions } from "../db/schema/impressions.js"
import { clicks } from "../db/schema/clicks.js"
import { devices } from "../db/schema/devices.js"
import { earningsLedger } from "../db/schema/earnings.js"
import {
  ApiError,
  NotFoundError,
  ConflictError,
  StateError,
  ForbiddenError,
  pgErrorCode,
} from "../errors/index.js"
import { recordSpend, rollbackSpend } from "../lib/budget.js"
import { incrementFrequency } from "../lib/frequency.js"
import { fireBeacon } from "../lib/beacon.js"
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
  deliveryJti: string
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
      category: creatives.category,
      cpmRate: creatives.cpmRate,
      viewabilityBeaconUrl: creatives.viewabilityBeaconUrl,
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
        eq(campaigns.status, "active"),
        sql`(${campaigns.startsAt} IS NULL OR ${campaigns.startsAt} <= ${now.toISOString()})`,
        sql`(${campaigns.endsAt} IS NULL OR ${campaigns.endsAt} > ${now.toISOString()})`
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
          surface: input.surface,
          durationMs: input.durationMs,
          result: input.result,
          cpmRate: row.cpmRate,
          earnedAmount,
          deliveryJti: input.deliveryJti,
        })
        .returning()

      if (!imp) throw new Error("impression insert returned no rows")

      // only create earnings for completed impressions
      if (input.result === "completed" && earnedAmount > 0) {
        await tx.insert(earningsLedger).values({
          userId: input.userId,
          impressionId: imp.id,
          amountUsdc: earnedAmount,
          surface: input.surface,
          adCategory: row.category as (typeof earningsLedger)["$inferInsert"]["adCategory"],
        })
      }

      return imp
    })
  } catch (err) {
    await rollbackSpend(row.campaignId, costPerImpression)
    if (pgErrorCode(err) === "23505") {
      throw new ConflictError("impression_already_recorded")
    }
    throw err
  }

  // fire-and-forget: increment frequency counters
  incrementFrequency(input.deviceId, row.campaignId, input.surface).catch((err) => {
    logger.warn({ err, deviceId: input.deviceId }, "incrementFrequency failed")
  })

  // fire-and-forget: transition campaign to completed if budget exhausted
  // skip for external ad network campaigns (carbon etc.) — they manage their own budget
  if (spendResult.exhausted && row.source !== "carbon") {
    transitionStatus(row.campaignId, "completed").catch((err) => {
      logger.warn({ err, campaignId: row.campaignId }, "auto-complete campaign failed")
    })
  }

  // fire external ad network beacons
  if (row.source === "carbon") {
    // viewability beacon fires only on completed impressions
    if (input.result === "completed" && row.viewabilityBeaconUrl) {
      fireBeacon(row.viewabilityBeaconUrl).catch((err) => {
        logger.warn({ err, creativeId: input.creativeId }, "carbon statview beacon failed")
      })
    }
  }

  return impression
}

// ── record click ────────────────────────────────────────────────────────────
// caller (route handler) must verify impression exists and ownership before calling.

export async function recordClick(impressionId: string) {
  const db = getDb()

  try {
    const [click] = await db.insert(clicks).values({ impressionId }).returning()
    if (!click) throw new Error("click insert returned no rows")
    return { clickId: click.id }
  } catch (err) {
    if (pgErrorCode(err) === "23505") {
      throw new ConflictError("click_already_recorded")
    }
    if (pgErrorCode(err) === "23503") {
      throw new NotFoundError("impression")
    }
    throw err
  }
}

// S3-06: click ingest path. Looks up the parent impression by delivery_jti.
// Extra in-memory map lets callers skip the DB hit when the parent was inserted
// in the same request.
export async function recordClickByJti(
  jti: string,
  userId: string,
  resolvedImpressionId?: string
): Promise<{ clickId: string; earningsDelta: number }> {
  const db = getDb()

  let impressionId = resolvedImpressionId
  if (!impressionId) {
    const [imp] = await db
      .select({ id: impressions.id, deviceId: impressions.deviceId })
      .from(impressions)
      .where(eq(impressions.deliveryJti, jti))
    if (!imp) throw new ApiError(404, "impression_not_synced")

    const [device] = await db
      .select({ userId: devices.userId })
      .from(devices)
      .where(eq(devices.id, imp.deviceId))
    if (!device || device.userId !== userId) throw new ForbiddenError("delivery_not_owned")
    impressionId = imp.id
  }

  try {
    const [click] = await db.insert(clicks).values({ impressionId }).returning()
    if (!click) throw new Error("click insert returned no rows")
    return { clickId: click.id, earningsDelta: 0 }
  } catch (err) {
    if (pgErrorCode(err) === "23505") throw new ConflictError("click_already_recorded")
    if (pgErrorCode(err) === "23503") throw new ApiError(404, "impression_not_synced")
    throw err
  }
}
