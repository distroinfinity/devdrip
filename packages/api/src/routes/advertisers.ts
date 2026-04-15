import { Router } from "express"
import { eq, sql, count } from "drizzle-orm"
import type { BillingInfo } from "@devdrip/shared"
import { getDb } from "../db/index.js"
import { advertisers } from "../db/schema/advertisers.js"
import { campaigns } from "../db/schema/campaigns.js"
import { logger } from "../lib/logger.js"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_BILLING_METHODS = ["stripe", "crypto", "invoice"] as const

export const advertisersRouter: ReturnType<typeof Router> = Router()

// ── helpers ─────────────────────────────────────────────────────────────────

function validateBillingInfo(billingInfo: Record<string, unknown>): string | null {
  const method = billingInfo["method"]
  if (!method || !(VALID_BILLING_METHODS as readonly string[]).includes(method as string)) {
    return "invalid_billing_method"
  }
  if (method === "stripe" && !billingInfo["stripeCustomerId"]) {
    return "stripe_customer_id_required"
  }
  if (method === "crypto" && !billingInfo["walletAddress"]) {
    return "wallet_address_required"
  }
  return null
}

function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } }
  return e.code ?? e.cause?.code
}

// ── POST / ──────────────────────────────────────────────────────────────────

advertisersRouter.post("/", async (req, res) => {
  const { name, contactEmail, companyName, billingInfo } = req.body as {
    name?: string
    contactEmail?: string
    companyName?: string
    billingInfo?: Record<string, unknown>
  }

  if (!name || typeof name !== "string" || name.length === 0 || name.length > 255) {
    await res.status(400).json({ error: "invalid_name" })
    return
  }
  if (
    !contactEmail ||
    typeof contactEmail !== "string" ||
    !EMAIL_RE.test(contactEmail) ||
    contactEmail.length > 255
  ) {
    await res.status(400).json({ error: "invalid_contact_email" })
    return
  }
  if (companyName !== undefined && (typeof companyName !== "string" || companyName.length > 255)) {
    await res.status(400).json({ error: "invalid_company_name" })
    return
  }
  if (billingInfo !== undefined) {
    if (typeof billingInfo !== "object" || billingInfo === null || Array.isArray(billingInfo)) {
      await res.status(400).json({ error: "invalid_billing_info" })
      return
    }
    const billingError = validateBillingInfo(billingInfo)
    if (billingError) {
      await res.status(400).json({ error: billingError })
      return
    }
  }

  const db = getDb()
  try {
    const [advertiser] = await db
      .insert(advertisers)
      .values({
        name,
        contactEmail,
        companyName: companyName ?? null,
        billingInfo: (billingInfo as unknown as BillingInfo) ?? null,
      })
      .returning()

    await res.status(201).json({ advertiser })
  } catch (err) {
    if (pgErrorCode(err) === "23505") {
      await res.status(409).json({ error: "email_already_exists" })
      return
    }
    logger.error({ err }, "create advertiser error")
    await res.status(500).json({ error: "internal_error" })
  }
})

// ── GET / ───────────────────────────────────────────────────────────────────

advertisersRouter.get("/", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query["limit"] ?? 20), 1), 100)
  const offset = Math.max(Number(req.query["offset"] ?? 0), 0)

  const db = getDb()
  try {
    const [rows, [totalRow]] = await Promise.all([
      db.select().from(advertisers).limit(limit).offset(offset).orderBy(advertisers.createdAt),
      db.select({ count: count() }).from(advertisers),
    ])

    await res.json({
      advertisers: rows,
      total: totalRow?.count ?? 0,
      limit,
      offset,
    })
  } catch (err) {
    logger.error({ err }, "list advertisers error")
    await res.status(500).json({ error: "internal_error" })
  }
})

// ── GET /:id ────────────────────────────────────────────────────────────────

advertisersRouter.get("/:id", async (req, res) => {
  const { id } = req.params
  if (!id || !UUID_RE.test(id)) {
    await res.status(400).json({ error: "invalid_id" })
    return
  }

  const db = getDb()
  try {
    const [advertiser] = await db.select().from(advertisers).where(eq(advertisers.id, id))
    if (!advertiser) {
      await res.status(404).json({ error: "advertiser_not_found" })
      return
    }
    await res.json({ advertiser })
  } catch (err) {
    logger.error({ err }, "get advertiser error")
    await res.status(500).json({ error: "internal_error" })
  }
})

// ── PATCH /:id ──────────────────────────────────────────────────────────────

advertisersRouter.patch("/:id", async (req, res) => {
  const { id } = req.params
  if (!id || !UUID_RE.test(id)) {
    await res.status(400).json({ error: "invalid_id" })
    return
  }

  const { name, contactEmail, companyName, billingInfo } = req.body as {
    name?: string
    contactEmail?: string
    companyName?: string | null
    billingInfo?: Record<string, unknown> | null
  }

  // at least one field must be provided
  if (
    name === undefined &&
    contactEmail === undefined &&
    companyName === undefined &&
    billingInfo === undefined
  ) {
    await res.status(400).json({ error: "no_fields_to_update" })
    return
  }

  const updates: Record<string, unknown> = {}

  if (name !== undefined) {
    if (typeof name !== "string" || name.length === 0 || name.length > 255) {
      await res.status(400).json({ error: "invalid_name" })
      return
    }
    updates["name"] = name
  }
  if (contactEmail !== undefined) {
    if (
      typeof contactEmail !== "string" ||
      !EMAIL_RE.test(contactEmail) ||
      contactEmail.length > 255
    ) {
      await res.status(400).json({ error: "invalid_contact_email" })
      return
    }
    updates["contactEmail"] = contactEmail
  }
  if (companyName !== undefined) {
    if (companyName !== null && (typeof companyName !== "string" || companyName.length > 255)) {
      await res.status(400).json({ error: "invalid_company_name" })
      return
    }
    updates["companyName"] = companyName
  }
  if (billingInfo !== undefined) {
    if (billingInfo !== null) {
      if (typeof billingInfo !== "object" || Array.isArray(billingInfo)) {
        await res.status(400).json({ error: "invalid_billing_info" })
        return
      }
      const billingError = validateBillingInfo(billingInfo)
      if (billingError) {
        await res.status(400).json({ error: billingError })
        return
      }
    }
    updates["billingInfo"] = billingInfo
  }

  const db = getDb()
  try {
    const [updated] = await db
      .update(advertisers)
      .set(updates)
      .where(eq(advertisers.id, id))
      .returning()

    if (!updated) {
      await res.status(404).json({ error: "advertiser_not_found" })
      return
    }
    await res.json({ advertiser: updated })
  } catch (err) {
    if (pgErrorCode(err) === "23505") {
      await res.status(409).json({ error: "email_already_exists" })
      return
    }
    logger.error({ err }, "update advertiser error")
    await res.status(500).json({ error: "internal_error" })
  }
})

// ── DELETE /:id ─────────────────────────────────────────────────────────────

advertisersRouter.delete("/:id", async (req, res) => {
  const { id } = req.params
  if (!id || !UUID_RE.test(id)) {
    await res.status(400).json({ error: "invalid_id" })
    return
  }

  const db = getDb()
  try {
    // guard: reject delete if advertiser has active campaigns
    // (campaigns CASCADE delete from advertisers — we don't want to nuke active campaigns)
    const [activeCampaign] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(sql`${campaigns.advertiserId} = ${id} AND ${campaigns.status} = 'active'`)
      .limit(1)

    if (activeCampaign) {
      await res.status(409).json({ error: "has_active_campaigns" })
      return
    }

    const [deleted] = await db.delete(advertisers).where(eq(advertisers.id, id)).returning()
    if (!deleted) {
      await res.status(404).json({ error: "advertiser_not_found" })
      return
    }
    await res.json({ advertiser: deleted })
  } catch (err) {
    logger.error({ err }, "delete advertiser error")
    await res.status(500).json({ error: "internal_error" })
  }
})
