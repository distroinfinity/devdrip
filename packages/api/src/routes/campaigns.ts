import { Router } from "express"
import { eq, and, sql, count } from "drizzle-orm"
import { AdCategory, AdSurface } from "@devdrip/shared"
import { getDb } from "../db/index.js"
import { advertisers } from "../db/schema/advertisers.js"
import { campaigns } from "../db/schema/campaigns.js"
import { creatives } from "../db/schema/creatives.js"
import { impressions } from "../db/schema/impressions.js"
import { clicks } from "../db/schema/clicks.js"
import { getDailySpend, getHourlySpend } from "../lib/budget.js"
import { logger } from "../lib/logger.js"
import { creativesRouter } from "./creatives.js"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_PACING = ["even", "front_loaded", "asap"] as const
const VALID_STATUSES = ["draft", "active", "paused", "completed"] as const
type CampaignStatus = (typeof VALID_STATUSES)[number]
const AD_CATEGORIES = Object.values(AdCategory) as string[]
const AD_SURFACES = Object.values(AdSurface) as string[]

const TRANSITIONS: Record<string, string[]> = {
  draft: ["active"],
  active: ["paused", "completed"],
  paused: ["active", "completed"],
  completed: [],
}

export const campaignsRouter: ReturnType<typeof Router> = Router()

// mount creatives as sub-router
campaignsRouter.use("/:campaignId/creatives", creativesRouter)

// ── helpers ─────────────────────────────────────────────────────────────────

function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } }
  return e.code ?? e.cause?.code
}

function isValidDate(val: string): boolean {
  const d = new Date(val)
  return !isNaN(d.getTime())
}

function validateTargetArray(arr: unknown, validValues: string[]): string | null {
  if (!Array.isArray(arr)) return "must_be_array"
  for (const item of arr) {
    if (typeof item !== "string" || !validValues.includes(item)) return "invalid_value"
  }
  return null
}

// ── POST / ──────────────────────────────────────────────────────────────────

campaignsRouter.post("/", async (req, res) => {
  const {
    advertiserId,
    name,
    budgetTotal,
    budgetDaily,
    cpmRate,
    targetCategories,
    targetSurfaces,
    targetingRules,
    pacingStrategy,
    startsAt,
    endsAt,
  } = req.body as Record<string, unknown>

  // required fields
  if (!advertiserId || typeof advertiserId !== "string" || !UUID_RE.test(advertiserId)) {
    await res.status(400).json({ error: "invalid_advertiser_id" })
    return
  }
  if (
    !name ||
    typeof name !== "string" ||
    (name as string).length === 0 ||
    (name as string).length > 255
  ) {
    await res.status(400).json({ error: "invalid_name" })
    return
  }
  if (typeof budgetTotal !== "number" || budgetTotal <= 0) {
    await res.status(400).json({ error: "invalid_budget_total" })
    return
  }
  if (typeof budgetDaily !== "number" || budgetDaily <= 0) {
    await res.status(400).json({ error: "invalid_budget_daily" })
    return
  }
  if (budgetDaily > budgetTotal) {
    await res.status(400).json({ error: "budget_daily_exceeds_total" })
    return
  }
  if (typeof cpmRate !== "number" || cpmRate <= 0) {
    await res.status(400).json({ error: "invalid_cpm_rate" })
    return
  }

  // optional arrays
  if (targetCategories !== undefined) {
    const err = validateTargetArray(targetCategories, AD_CATEGORIES)
    if (err) {
      await res.status(400).json({ error: "invalid_target_categories" })
      return
    }
  }
  if (targetSurfaces !== undefined) {
    const err = validateTargetArray(targetSurfaces, AD_SURFACES)
    if (err) {
      await res.status(400).json({ error: "invalid_target_surfaces" })
      return
    }
  }

  // optional targeting rules
  if (
    targetingRules !== undefined &&
    (typeof targetingRules !== "object" || targetingRules === null || Array.isArray(targetingRules))
  ) {
    await res.status(400).json({ error: "invalid_targeting_rules" })
    return
  }

  // optional pacing
  let pacing: "even" | "front_loaded" | "asap" = "even"
  if (pacingStrategy !== undefined) {
    if (!(VALID_PACING as readonly string[]).includes(pacingStrategy as string)) {
      await res.status(400).json({ error: "invalid_pacing_strategy" })
      return
    }
    pacing = pacingStrategy as typeof pacing
  }

  // optional dates
  let parsedStartsAt: Date | undefined
  let parsedEndsAt: Date | undefined
  if (startsAt !== undefined) {
    if (typeof startsAt !== "string" || !isValidDate(startsAt)) {
      await res.status(400).json({ error: "invalid_starts_at" })
      return
    }
    parsedStartsAt = new Date(startsAt)
  }
  if (endsAt !== undefined) {
    if (typeof endsAt !== "string" || !isValidDate(endsAt)) {
      await res.status(400).json({ error: "invalid_ends_at" })
      return
    }
    parsedEndsAt = new Date(endsAt)
  }
  if (parsedStartsAt && parsedEndsAt && parsedEndsAt <= parsedStartsAt) {
    await res.status(400).json({ error: "ends_at_must_be_after_starts_at" })
    return
  }

  const db = getDb()

  // FK check: advertiser must exist
  const [adv] = await db
    .select({ id: advertisers.id })
    .from(advertisers)
    .where(eq(advertisers.id, advertiserId as string))
  if (!adv) {
    await res.status(404).json({ error: "advertiser_not_found" })
    return
  }

  try {
    const [campaign] = await db
      .insert(campaigns)
      .values({
        advertiserId: advertiserId as string,
        name: name as string,
        budgetTotal: budgetTotal as number,
        budgetDaily: budgetDaily as number,
        cpmRate: cpmRate as number,
        targetCategories: (targetCategories as string[]) ?? [],
        targetSurfaces: (targetSurfaces as string[]) ?? [],
        targetingRules: targetingRules ?? null,
        pacingStrategy: pacing,
        startsAt: parsedStartsAt ?? null,
        endsAt: parsedEndsAt ?? null,
      })
      .returning()

    await res.status(201).json({ campaign })
  } catch (err) {
    logger.error({ err }, "create campaign error")
    await res.status(500).json({ error: "internal_error" })
  }
})

// ── GET / ───────────────────────────────────────────────────────────────────

campaignsRouter.get("/", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query["limit"] ?? 20), 1), 100)
  const offset = Math.max(Number(req.query["offset"] ?? 0), 0)
  const statusFilter = req.query["status"] as string | undefined
  const advertiserIdFilter = req.query["advertiserId"] as string | undefined

  if (statusFilter && !(VALID_STATUSES as readonly string[]).includes(statusFilter)) {
    await res.status(400).json({ error: "invalid_status_filter" })
    return
  }
  if (advertiserIdFilter && !UUID_RE.test(advertiserIdFilter)) {
    await res.status(400).json({ error: "invalid_advertiser_id_filter" })
    return
  }

  const db = getDb()
  try {
    const conditions = []
    if (statusFilter) {
      conditions.push(eq(campaigns.status, statusFilter as CampaignStatus))
    }
    if (advertiserIdFilter) {
      conditions.push(eq(campaigns.advertiserId, advertiserIdFilter))
    }

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

    await res.json({
      campaigns: rows,
      total: totalRow?.count ?? 0,
      limit,
      offset,
    })
  } catch (err) {
    logger.error({ err }, "list campaigns error")
    await res.status(500).json({ error: "internal_error" })
  }
})

// ── GET /:id ────────────────────────────────────────────────────────────────

campaignsRouter.get("/:id", async (req, res) => {
  const { id } = req.params
  if (!id || !UUID_RE.test(id)) {
    await res.status(400).json({ error: "invalid_id" })
    return
  }

  const db = getDb()
  try {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id))
    if (!campaign) {
      await res.status(404).json({ error: "campaign_not_found" })
      return
    }
    await res.json({ campaign })
  } catch (err) {
    logger.error({ err }, "get campaign error")
    await res.status(500).json({ error: "internal_error" })
  }
})

// ── PATCH /:id ──────────────────────────────────────────────────────────────

campaignsRouter.patch("/:id", async (req, res) => {
  const { id } = req.params
  if (!id || !UUID_RE.test(id)) {
    await res.status(400).json({ error: "invalid_id" })
    return
  }

  const body = req.body as Record<string, unknown>

  // reject status changes — use the dedicated endpoint
  if (body["status"] !== undefined) {
    await res.status(422).json({ error: "use_status_endpoint" })
    return
  }

  const updates: Record<string, unknown> = {}
  const allowedFields = [
    "name",
    "budgetTotal",
    "budgetDaily",
    "cpmRate",
    "targetCategories",
    "targetSurfaces",
    "targetingRules",
    "pacingStrategy",
    "startsAt",
    "endsAt",
  ]

  const hasAnyField = allowedFields.some((f) => body[f] !== undefined)
  if (!hasAnyField) {
    await res.status(400).json({ error: "no_fields_to_update" })
    return
  }

  if (body["name"] !== undefined) {
    const name = body["name"]
    if (typeof name !== "string" || name.length === 0 || name.length > 255) {
      await res.status(400).json({ error: "invalid_name" })
      return
    }
    updates["name"] = name
  }
  if (body["cpmRate"] !== undefined) {
    if (typeof body["cpmRate"] !== "number" || body["cpmRate"] <= 0) {
      await res.status(400).json({ error: "invalid_cpm_rate" })
      return
    }
    updates["cpmRate"] = body["cpmRate"]
  }
  if (body["targetCategories"] !== undefined) {
    const err = validateTargetArray(body["targetCategories"], AD_CATEGORIES)
    if (err) {
      await res.status(400).json({ error: "invalid_target_categories" })
      return
    }
    updates["targetCategories"] = body["targetCategories"]
  }
  if (body["targetSurfaces"] !== undefined) {
    const err = validateTargetArray(body["targetSurfaces"], AD_SURFACES)
    if (err) {
      await res.status(400).json({ error: "invalid_target_surfaces" })
      return
    }
    updates["targetSurfaces"] = body["targetSurfaces"]
  }
  if (body["targetingRules"] !== undefined) {
    const tr = body["targetingRules"]
    if (tr !== null && (typeof tr !== "object" || Array.isArray(tr))) {
      await res.status(400).json({ error: "invalid_targeting_rules" })
      return
    }
    updates["targetingRules"] = tr
  }
  if (body["pacingStrategy"] !== undefined) {
    if (!(VALID_PACING as readonly string[]).includes(body["pacingStrategy"] as string)) {
      await res.status(400).json({ error: "invalid_pacing_strategy" })
      return
    }
    updates["pacingStrategy"] = body["pacingStrategy"]
  }
  if (body["startsAt"] !== undefined) {
    const sa = body["startsAt"]
    if (sa !== null && (typeof sa !== "string" || !isValidDate(sa))) {
      await res.status(400).json({ error: "invalid_starts_at" })
      return
    }
    updates["startsAt"] = sa ? new Date(sa) : null
  }
  if (body["endsAt"] !== undefined) {
    const ea = body["endsAt"]
    if (ea !== null && (typeof ea !== "string" || !isValidDate(ea))) {
      await res.status(400).json({ error: "invalid_ends_at" })
      return
    }
    updates["endsAt"] = ea ? new Date(ea) : null
  }

  // budget validation requires fetching current campaign state
  const db = getDb()

  if (body["budgetTotal"] !== undefined || body["budgetDaily"] !== undefined) {
    const [current] = await db.select().from(campaigns).where(eq(campaigns.id, id))
    if (!current) {
      await res.status(404).json({ error: "campaign_not_found" })
      return
    }

    const newTotal =
      typeof body["budgetTotal"] === "number" ? body["budgetTotal"] : current.budgetTotal
    const newDaily =
      typeof body["budgetDaily"] === "number" ? body["budgetDaily"] : current.budgetDaily

    if (typeof body["budgetTotal"] === "number") {
      if (body["budgetTotal"] <= 0) {
        await res.status(400).json({ error: "invalid_budget_total" })
        return
      }
      if (body["budgetTotal"] < current.budgetSpent) {
        await res.status(400).json({ error: "budget_total_below_spent" })
        return
      }
      updates["budgetTotal"] = body["budgetTotal"]
    }
    if (typeof body["budgetDaily"] === "number") {
      if (body["budgetDaily"] <= 0) {
        await res.status(400).json({ error: "invalid_budget_daily" })
        return
      }
      updates["budgetDaily"] = body["budgetDaily"]
    }
    if (newDaily > newTotal) {
      await res.status(400).json({ error: "budget_daily_exceeds_total" })
      return
    }
  }

  try {
    const [updated] = await db
      .update(campaigns)
      .set(updates)
      .where(eq(campaigns.id, id))
      .returning()

    if (!updated) {
      await res.status(404).json({ error: "campaign_not_found" })
      return
    }
    await res.json({ campaign: updated })
  } catch (err) {
    if (pgErrorCode(err) === "23514") {
      await res.status(400).json({ error: "check_constraint_violated" })
      return
    }
    logger.error({ err }, "update campaign error")
    await res.status(500).json({ error: "internal_error" })
  }
})

// ── PATCH /:id/status ───────────────────────────────────────────────────────

campaignsRouter.patch("/:id/status", async (req, res) => {
  const { id } = req.params
  if (!id || !UUID_RE.test(id)) {
    await res.status(400).json({ error: "invalid_id" })
    return
  }

  const { status } = req.body as { status?: string }
  if (!status || !(VALID_STATUSES as readonly string[]).includes(status)) {
    await res.status(400).json({ error: "invalid_status" })
    return
  }

  const db = getDb()

  try {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id))
    if (!campaign) {
      await res.status(404).json({ error: "campaign_not_found" })
      return
    }

    // validate transition
    const allowed = TRANSITIONS[campaign.status]
    if (!allowed || !allowed.includes(status)) {
      await res.status(422).json({
        error: "invalid_status_transition",
        from: campaign.status,
        to: status,
      })
      return
    }

    // guards for activation
    if (status === "active") {
      // must have at least 1 active creative
      const [creativeCount] = await db
        .select({ count: count() })
        .from(creatives)
        .where(and(eq(creatives.campaignId, id), eq(creatives.isActive, true)))

      if (!creativeCount || creativeCount.count === 0) {
        await res.status(422).json({ error: "no_active_creatives" })
        return
      }

      // end date must be in the future (if set)
      if (campaign.endsAt && campaign.endsAt <= new Date()) {
        await res.status(422).json({ error: "campaign_ended" })
        return
      }

      // budget must not be exhausted
      if (campaign.budgetSpent >= campaign.budgetTotal) {
        await res.status(422).json({ error: "budget_exhausted" })
        return
      }
    }

    const [updated] = await db
      .update(campaigns)
      .set({ status: status as CampaignStatus })
      .where(eq(campaigns.id, id))
      .returning()

    await res.json({ campaign: updated })
  } catch (err) {
    logger.error({ err }, "campaign status transition error")
    await res.status(500).json({ error: "internal_error" })
  }
})

// ── DELETE /:id ─────────────────────────────────────────────────────────────

campaignsRouter.delete("/:id", async (req, res) => {
  const { id } = req.params
  if (!id || !UUID_RE.test(id)) {
    await res.status(400).json({ error: "invalid_id" })
    return
  }

  const db = getDb()
  try {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id))
    if (!campaign) {
      await res.status(404).json({ error: "campaign_not_found" })
      return
    }

    if (campaign.status !== "draft") {
      await res.status(409).json({ error: "only_draft_deletable" })
      return
    }

    const [deleted] = await db.delete(campaigns).where(eq(campaigns.id, id)).returning()
    await res.json({ campaign: deleted })
  } catch (err) {
    logger.error({ err }, "delete campaign error")
    await res.status(500).json({ error: "internal_error" })
  }
})

// ── GET /:id/stats ──────────────────────────────────────────────────────────

campaignsRouter.get("/:id/stats", async (req, res) => {
  const { id } = req.params
  if (!id || !UUID_RE.test(id)) {
    await res.status(400).json({ error: "invalid_id" })
    return
  }

  const db = getDb()
  try {
    // verify campaign exists
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id))
    if (!campaign) {
      await res.status(404).json({ error: "campaign_not_found" })
      return
    }

    // run DB aggregation and Redis reads in parallel
    const [dbStats, dailySpend, hourlySpend] = await Promise.all([
      db
        .select({
          totalImpressions: count(impressions.id),
          completedImpressions: sql<number>`count(case when ${impressions.result} = 'completed' then 1 end)`,
          clicks: count(clicks.id),
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

    await res.json({
      campaignId: id,
      totalImpressions,
      completedImpressions,
      clicks: clickCount,
      ctr: completedImpressions > 0 ? clickCount / completedImpressions : 0,
      budgetSpent: campaign.budgetSpent,
      dailySpendToday: dailySpend,
      hourlySpendNow: hourlySpend,
    })
  } catch (err) {
    logger.error({ err }, "campaign stats error")
    await res.status(500).json({ error: "internal_error" })
  }
})
