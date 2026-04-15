import { Router, type Request } from "express"
import { eq, and, count } from "drizzle-orm"
import { AdCategory, AdSource, AdSurface } from "@devdrip/shared"
import { getDb } from "../db/index.js"
import { campaigns } from "../db/schema/campaigns.js"
import { creatives } from "../db/schema/creatives.js"
import { logger } from "../lib/logger.js"

type CampaignParams = { campaignId: string }
type CreativeParams = { campaignId: string; id: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_FORMATS = ["text", "banner", "sponsored-link"] as const
const AD_CATEGORIES = Object.values(AdCategory) as string[]
const AD_SOURCES = Object.values(AdSource) as string[]
const AD_SURFACES = Object.values(AdSurface) as string[]

type AdFormat = (typeof VALID_FORMATS)[number]
type AdSurfaceVal = (typeof creatives.$inferInsert)["surface"]
type AdCategoryVal = (typeof creatives.$inferInsert)["category"]
type AdSourceVal = (typeof creatives.$inferInsert)["source"]

export const creativesRouter: ReturnType<typeof Router> = Router({ mergeParams: true })

// ── helpers ─────────────────────────────────────────────────────────────────

function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } }
  return e.code ?? e.cause?.code
}

function validateUrl(val: unknown): boolean {
  return typeof val === "string" && val.length <= 2048 && val.startsWith("https://")
}

async function verifyCampaignExists(campaignId: string): Promise<boolean> {
  const db = getDb()
  const [row] = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
  return !!row
}

// ── POST / ──────────────────────────────────────────────────────────────────

creativesRouter.post("/", async (req: Request<CampaignParams>, res) => {
  const { campaignId } = req.params
  if (!campaignId || !UUID_RE.test(campaignId)) {
    await res.status(400).json({ error: "invalid_campaign_id" })
    return
  }

  const {
    headline,
    body: bodyText,
    ctaText,
    ctaUrl,
    format,
    surface,
    category,
    source,
    cpmRate,
    impressionBeaconUrl,
    clickTrackingUrl,
    externalCampaignId,
    externalCreativeId,
  } = req.body as Record<string, unknown>

  // required fields
  if (
    !headline ||
    typeof headline !== "string" ||
    (headline as string).length === 0 ||
    (headline as string).length > 60
  ) {
    await res.status(400).json({ error: "invalid_headline" })
    return
  }
  if (
    bodyText !== undefined &&
    bodyText !== null &&
    (typeof bodyText !== "string" || (bodyText as string).length > 140)
  ) {
    await res.status(400).json({ error: "invalid_body" })
    return
  }
  if (
    ctaText !== undefined &&
    ctaText !== null &&
    (typeof ctaText !== "string" || (ctaText as string).length > 30)
  ) {
    await res.status(400).json({ error: "invalid_cta_text" })
    return
  }
  if (ctaUrl !== undefined && ctaUrl !== null && !validateUrl(ctaUrl)) {
    await res.status(400).json({ error: "invalid_cta_url" })
    return
  }
  if (!format || !(VALID_FORMATS as readonly string[]).includes(format as string)) {
    await res.status(400).json({ error: "invalid_format" })
    return
  }
  if (!surface || !AD_SURFACES.includes(surface as string)) {
    await res.status(400).json({ error: "invalid_surface" })
    return
  }
  if (!category || !AD_CATEGORIES.includes(category as string)) {
    await res.status(400).json({ error: "invalid_category" })
    return
  }
  if (!source || !AD_SOURCES.includes(source as string)) {
    await res.status(400).json({ error: "invalid_source" })
    return
  }
  if (typeof cpmRate !== "number" || cpmRate <= 0) {
    await res.status(400).json({ error: "invalid_cpm_rate" })
    return
  }

  // optional URL fields
  if (
    impressionBeaconUrl !== undefined &&
    impressionBeaconUrl !== null &&
    !validateUrl(impressionBeaconUrl)
  ) {
    await res.status(400).json({ error: "invalid_impression_beacon_url" })
    return
  }
  if (
    clickTrackingUrl !== undefined &&
    clickTrackingUrl !== null &&
    !validateUrl(clickTrackingUrl)
  ) {
    await res.status(400).json({ error: "invalid_click_tracking_url" })
    return
  }
  if (
    externalCampaignId !== undefined &&
    externalCampaignId !== null &&
    (typeof externalCampaignId !== "string" || (externalCampaignId as string).length > 255)
  ) {
    await res.status(400).json({ error: "invalid_external_campaign_id" })
    return
  }
  if (
    externalCreativeId !== undefined &&
    externalCreativeId !== null &&
    (typeof externalCreativeId !== "string" || (externalCreativeId as string).length > 255)
  ) {
    await res.status(400).json({ error: "invalid_external_creative_id" })
    return
  }

  // verify campaign exists
  if (!(await verifyCampaignExists(campaignId))) {
    await res.status(404).json({ error: "campaign_not_found" })
    return
  }

  const db = getDb()
  try {
    const [creative] = await db
      .insert(creatives)
      .values({
        campaignId,
        headline: headline as string,
        body: (bodyText as string) ?? null,
        ctaText: (ctaText as string) ?? null,
        ctaUrl: (ctaUrl as string) ?? null,
        format: format as AdFormat,
        surface: surface as AdSurfaceVal,
        category: category as AdCategoryVal,
        source: source as AdSourceVal,
        cpmRate: cpmRate as number,
        impressionBeaconUrl: (impressionBeaconUrl as string) ?? null,
        clickTrackingUrl: (clickTrackingUrl as string) ?? null,
        externalCampaignId: (externalCampaignId as string) ?? null,
        externalCreativeId: (externalCreativeId as string) ?? null,
      })
      .returning()

    await res.status(201).json({ creative })
  } catch (err) {
    logger.error({ err }, "create creative error")
    await res.status(500).json({ error: "internal_error" })
  }
})

// ── GET / ───────────────────────────────────────────────────────────────────

creativesRouter.get("/", async (req: Request<CampaignParams>, res) => {
  const { campaignId } = req.params
  if (!campaignId || !UUID_RE.test(campaignId)) {
    await res.status(400).json({ error: "invalid_campaign_id" })
    return
  }

  const limit = Math.min(Math.max(Number(req.query["limit"] ?? 50), 1), 100)
  const offset = Math.max(Number(req.query["offset"] ?? 0), 0)
  const isActiveFilter = req.query["isActive"] as string | undefined

  // verify campaign exists
  if (!(await verifyCampaignExists(campaignId))) {
    await res.status(404).json({ error: "campaign_not_found" })
    return
  }

  const db = getDb()
  try {
    const conditions = [eq(creatives.campaignId, campaignId)]
    if (isActiveFilter === "true") conditions.push(eq(creatives.isActive, true))
    if (isActiveFilter === "false") conditions.push(eq(creatives.isActive, false))

    const where = and(...conditions)

    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(creatives)
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(creatives.createdAt),
      db.select({ count: count() }).from(creatives).where(where),
    ])

    await res.json({
      creatives: rows,
      total: totalRow?.count ?? 0,
      limit,
      offset,
    })
  } catch (err) {
    logger.error({ err }, "list creatives error")
    await res.status(500).json({ error: "internal_error" })
  }
})

// ── GET /:id ────────────────────────────────────────────────────────────────

creativesRouter.get("/:id", async (req: Request<CreativeParams>, res) => {
  const { campaignId, id } = req.params
  if (!campaignId || !UUID_RE.test(campaignId)) {
    await res.status(400).json({ error: "invalid_campaign_id" })
    return
  }
  if (!id || !UUID_RE.test(id)) {
    await res.status(400).json({ error: "invalid_id" })
    return
  }

  const db = getDb()
  try {
    const [creative] = await db
      .select()
      .from(creatives)
      .where(and(eq(creatives.id, id), eq(creatives.campaignId, campaignId)))

    if (!creative) {
      await res.status(404).json({ error: "creative_not_found" })
      return
    }
    await res.json({ creative })
  } catch (err) {
    logger.error({ err }, "get creative error")
    await res.status(500).json({ error: "internal_error" })
  }
})

// ── PATCH /:id ──────────────────────────────────────────────────────────────

creativesRouter.patch("/:id", async (req: Request<CreativeParams>, res) => {
  const { campaignId, id } = req.params
  if (!campaignId || !UUID_RE.test(campaignId)) {
    await res.status(400).json({ error: "invalid_campaign_id" })
    return
  }
  if (!id || !UUID_RE.test(id)) {
    await res.status(400).json({ error: "invalid_id" })
    return
  }

  const body = req.body as Record<string, unknown>

  const allowedFields = [
    "headline",
    "body",
    "ctaText",
    "ctaUrl",
    "format",
    "surface",
    "category",
    "source",
    "cpmRate",
    "impressionBeaconUrl",
    "clickTrackingUrl",
    "externalCampaignId",
    "externalCreativeId",
    "isActive",
  ]
  const hasAnyField = allowedFields.some((f) => body[f] !== undefined)
  if (!hasAnyField) {
    await res.status(400).json({ error: "no_fields_to_update" })
    return
  }

  const updates: Record<string, unknown> = {}

  if (body["headline"] !== undefined) {
    const h = body["headline"]
    if (typeof h !== "string" || h.length === 0 || h.length > 60) {
      await res.status(400).json({ error: "invalid_headline" })
      return
    }
    updates["headline"] = h
  }
  if (body["body"] !== undefined) {
    const b = body["body"]
    if (b !== null && (typeof b !== "string" || (b as string).length > 140)) {
      await res.status(400).json({ error: "invalid_body" })
      return
    }
    updates["body"] = b
  }
  if (body["ctaText"] !== undefined) {
    const c = body["ctaText"]
    if (c !== null && (typeof c !== "string" || (c as string).length > 30)) {
      await res.status(400).json({ error: "invalid_cta_text" })
      return
    }
    updates["ctaText"] = c
  }
  if (body["ctaUrl"] !== undefined) {
    const c = body["ctaUrl"]
    if (c !== null && !validateUrl(c)) {
      await res.status(400).json({ error: "invalid_cta_url" })
      return
    }
    updates["ctaUrl"] = c
  }
  if (body["format"] !== undefined) {
    if (!(VALID_FORMATS as readonly string[]).includes(body["format"] as string)) {
      await res.status(400).json({ error: "invalid_format" })
      return
    }
    updates["format"] = body["format"]
  }
  if (body["surface"] !== undefined) {
    if (!AD_SURFACES.includes(body["surface"] as string)) {
      await res.status(400).json({ error: "invalid_surface" })
      return
    }
    updates["surface"] = body["surface"]
  }
  if (body["category"] !== undefined) {
    if (!AD_CATEGORIES.includes(body["category"] as string)) {
      await res.status(400).json({ error: "invalid_category" })
      return
    }
    updates["category"] = body["category"]
  }
  if (body["source"] !== undefined) {
    if (!AD_SOURCES.includes(body["source"] as string)) {
      await res.status(400).json({ error: "invalid_source" })
      return
    }
    updates["source"] = body["source"]
  }
  if (body["cpmRate"] !== undefined) {
    if (typeof body["cpmRate"] !== "number" || body["cpmRate"] <= 0) {
      await res.status(400).json({ error: "invalid_cpm_rate" })
      return
    }
    updates["cpmRate"] = body["cpmRate"]
  }
  if (body["impressionBeaconUrl"] !== undefined) {
    const u = body["impressionBeaconUrl"]
    if (u !== null && !validateUrl(u)) {
      await res.status(400).json({ error: "invalid_impression_beacon_url" })
      return
    }
    updates["impressionBeaconUrl"] = u
  }
  if (body["clickTrackingUrl"] !== undefined) {
    const u = body["clickTrackingUrl"]
    if (u !== null && !validateUrl(u)) {
      await res.status(400).json({ error: "invalid_click_tracking_url" })
      return
    }
    updates["clickTrackingUrl"] = u
  }
  if (body["externalCampaignId"] !== undefined) {
    const e = body["externalCampaignId"]
    if (e !== null && (typeof e !== "string" || (e as string).length > 255)) {
      await res.status(400).json({ error: "invalid_external_campaign_id" })
      return
    }
    updates["externalCampaignId"] = e
  }
  if (body["externalCreativeId"] !== undefined) {
    const e = body["externalCreativeId"]
    if (e !== null && (typeof e !== "string" || (e as string).length > 255)) {
      await res.status(400).json({ error: "invalid_external_creative_id" })
      return
    }
    updates["externalCreativeId"] = e
  }
  if (body["isActive"] !== undefined) {
    if (typeof body["isActive"] !== "boolean") {
      await res.status(400).json({ error: "invalid_is_active" })
      return
    }
    updates["isActive"] = body["isActive"]
  }

  const db = getDb()
  try {
    const [updated] = await db
      .update(creatives)
      .set(updates)
      .where(and(eq(creatives.id, id), eq(creatives.campaignId, campaignId)))
      .returning()

    if (!updated) {
      await res.status(404).json({ error: "creative_not_found" })
      return
    }
    await res.json({ creative: updated })
  } catch (err) {
    if (pgErrorCode(err) === "23514") {
      await res.status(400).json({ error: "check_constraint_violated" })
      return
    }
    logger.error({ err }, "update creative error")
    await res.status(500).json({ error: "internal_error" })
  }
})

// ── DELETE /:id ─────────────────────────────────────────────────────────────

creativesRouter.delete("/:id", async (req: Request<CreativeParams>, res) => {
  const { campaignId, id } = req.params
  if (!campaignId || !UUID_RE.test(campaignId)) {
    await res.status(400).json({ error: "invalid_campaign_id" })
    return
  }
  if (!id || !UUID_RE.test(id)) {
    await res.status(400).json({ error: "invalid_id" })
    return
  }

  const db = getDb()
  try {
    const [deleted] = await db
      .delete(creatives)
      .where(and(eq(creatives.id, id), eq(creatives.campaignId, campaignId)))
      .returning()

    if (!deleted) {
      await res.status(404).json({ error: "creative_not_found" })
      return
    }
    await res.json({ creative: deleted })
  } catch (err) {
    // impressions FK is ON DELETE RESTRICT — can't delete creative with impressions
    if (pgErrorCode(err) === "23503") {
      await res.status(409).json({ error: "creative_has_impressions", hint: "deactivate_instead" })
      return
    }
    logger.error({ err }, "delete creative error")
    await res.status(500).json({ error: "internal_error" })
  }
})
