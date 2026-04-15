import { eq, and, count, countDistinct, sql } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { advertisers } from "../db/schema/advertisers.js"
import { campaigns } from "../db/schema/campaigns.js"
import { creatives } from "../db/schema/creatives.js"
import { impressions } from "../db/schema/impressions.js"
import { clicks } from "../db/schema/clicks.js"
import { NotFoundError, ConflictError, StateError } from "../errors/index.js"
import { getDailySpend, getHourlySpend } from "./campaign-budget.service.js"
import { deleteRotationKey } from "../lib/budget.js"
import type {
  CreateCampaignInput,
  UpdateCampaignInput,
  CampaignStatus,
} from "../validators/campaign.validators.js"

// ── state machine ───────────────────────────────────────────────────────────

const TRANSITIONS: Record<string, string[]> = {
  draft: ["active"],
  active: ["paused", "completed"],
  paused: ["active", "completed"],
  completed: [],
}

// ── create ──────────────────────────────────────────────────────────────────

export async function create(input: CreateCampaignInput) {
  const db = getDb()

  // FK check: advertiser must exist
  const [adv] = await db
    .select({ id: advertisers.id })
    .from(advertisers)
    .where(eq(advertisers.id, input.advertiserId))
  if (!adv) throw new NotFoundError("advertiser")

  const [campaign] = await db.insert(campaigns).values(input).returning()
  if (!campaign) throw new Error("insert returned no rows")
  return campaign
}

// ── list ────────────────────────────────────────────────────────────────────

export async function list(
  limit: number,
  offset: number,
  filters: { status?: CampaignStatus; advertiserId?: string }
) {
  const db = getDb()
  const conditions = []
  if (filters.status) conditions.push(eq(campaigns.status, filters.status))
  if (filters.advertiserId) conditions.push(eq(campaigns.advertiserId, filters.advertiserId))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(campaigns)
      .where(where)
      .limit(limit)
      .offset(offset)
      .orderBy(campaigns.createdAt),
    db.select({ count: count() }).from(campaigns).where(where),
  ])

  return { campaigns: rows, total: totalRow?.count ?? 0 }
}

// ── get by id ───────────────────────────────────────────────────────────────

export async function getById(id: string) {
  const db = getDb()
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id))
  if (!campaign) throw new NotFoundError("campaign")
  return campaign
}

// ── update ──────────────────────────────────────────────────────────────────

export async function update(id: string, input: UpdateCampaignInput) {
  const db = getDb()

  // use transaction with FOR UPDATE to prevent stale-read race on budget fields
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(campaigns).where(eq(campaigns.id, id)).for("update")
    if (!current) throw new NotFoundError("campaign")

    const [updated] = await tx.update(campaigns).set(input).where(eq(campaigns.id, id)).returning()
    if (!updated) throw new NotFoundError("campaign")
    return updated
  })
}

// ── status transition (atomic) ──────────────────────────────────────────────

export async function transitionStatus(id: string, toStatus: CampaignStatus) {
  const db = getDb()

  return db.transaction(async (tx) => {
    // lock the row to prevent concurrent transitions
    const [campaign] = await tx.select().from(campaigns).where(eq(campaigns.id, id)).for("update")
    if (!campaign) throw new NotFoundError("campaign")

    // validate transition is allowed
    const allowed = TRANSITIONS[campaign.status]
    if (!allowed || !allowed.includes(toStatus)) {
      throw new StateError("invalid_status_transition", {
        from: campaign.status,
        to: toStatus,
      })
    }

    // activation guards
    if (toStatus === "active") {
      // must have at least 1 active creative
      const [creativeCount] = await tx
        .select({ count: count() })
        .from(creatives)
        .where(and(eq(creatives.campaignId, id), eq(creatives.isActive, true)))
      if (!creativeCount || creativeCount.count === 0) {
        throw new StateError("no_active_creatives")
      }

      // end date must be in the future (if set)
      if (campaign.endsAt && campaign.endsAt <= new Date()) {
        throw new StateError("campaign_ended")
      }

      // start date must not be in the future (if set)
      if (campaign.startsAt && campaign.startsAt > new Date()) {
        throw new StateError("campaign_not_started")
      }

      // budget must not be exhausted
      if (campaign.budgetSpent >= campaign.budgetTotal) {
        throw new StateError("budget_exhausted")
      }
    }

    // atomic write — WHERE status ensures no race even without FOR UPDATE
    const [updated] = await tx
      .update(campaigns)
      .set({ status: toStatus as CampaignStatus })
      .where(and(eq(campaigns.id, id), eq(campaigns.status, campaign.status as CampaignStatus)))
      .returning()

    if (!updated) throw new ConflictError("status_conflict")

    // cleanup on completion — remove Redis rotation key
    if (toStatus === "completed") {
      // fire-and-forget, don't block the transaction
      deleteRotationKey(id).catch(() => {})
    }

    return updated
  })
}

// ── delete ──────────────────────────────────────────────────────────────────

export async function remove(id: string) {
  const db = getDb()
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id))
  if (!campaign) throw new NotFoundError("campaign")
  if (campaign.status !== "draft") throw new ConflictError("only_draft_deletable")

  const [deleted] = await db.delete(campaigns).where(eq(campaigns.id, id)).returning()
  if (!deleted) throw new NotFoundError("campaign")
  return deleted
}

// ── stats ───────────────────────────────────────────────────────────────────

export async function getStats(id: string) {
  const db = getDb()
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id))
  if (!campaign) throw new NotFoundError("campaign")

  // run DB aggregation and Redis reads in parallel
  // use countDistinct to prevent LEFT JOIN inflation
  const [dbStats, dailySpend, hourlySpend] = await Promise.all([
    db
      .select({
        totalImpressions: countDistinct(impressions.id),
        completedImpressions: sql<number>`count(distinct case when ${impressions.result} = 'completed' then ${impressions.id} end)`,
        clicks: countDistinct(clicks.id),
      })
      .from(impressions)
      .innerJoin(creatives, eq(impressions.creativeId, creatives.id))
      .leftJoin(clicks, eq(clicks.impressionId, impressions.id))
      .where(eq(creatives.campaignId, id)),
    getDailySpend(id),
    getHourlySpend(id),
  ])

  const stats = dbStats[0]
  const totalImpressions = stats?.totalImpressions ?? 0
  const completedImpressions = stats?.completedImpressions ?? 0
  const clickCount = stats?.clicks ?? 0

  return {
    campaignId: id,
    totalImpressions,
    completedImpressions,
    clicks: clickCount,
    ctr: completedImpressions > 0 ? clickCount / completedImpressions : 0,
    budgetSpent: campaign.budgetSpent,
    dailySpendToday: dailySpend,
    hourlySpendNow: hourlySpend,
  }
}
