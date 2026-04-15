import { eq, and, count } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { campaigns } from "../db/schema/campaigns.js"
import { creatives } from "../db/schema/creatives.js"
import { NotFoundError, ConflictError, pgErrorCode } from "../errors/index.js"
import type { CreateCreativeInput, UpdateCreativeInput } from "../validators/creative.validators.js"

// ── helpers ─────────────────────────────────────────────────────────────────

async function requireCampaign(campaignId: string) {
  const db = getDb()
  const [row] = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
  if (!row) throw new NotFoundError("campaign")
}

// ── create ──────────────────────────────────────────────────────────────────

export async function create(input: CreateCreativeInput) {
  await requireCampaign(input.campaignId)
  const db = getDb()
  const [creative] = await db
    .insert(creatives)
    .values(input as never)
    .returning()
  if (!creative) throw new Error("insert returned no rows")
  return creative
}

// ── list ────────────────────────────────────────────────────────────────────

export async function list(
  campaignId: string,
  limit: number,
  offset: number,
  isActiveFilter?: boolean
) {
  await requireCampaign(campaignId)
  const db = getDb()

  const conditions = [eq(creatives.campaignId, campaignId)]
  if (isActiveFilter === true) conditions.push(eq(creatives.isActive, true))
  if (isActiveFilter === false) conditions.push(eq(creatives.isActive, false))

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

  return { creatives: rows, total: totalRow?.count ?? 0 }
}

// ── get by id ───────────────────────────────────────────────────────────────

export async function getById(campaignId: string, id: string) {
  const db = getDb()
  const [creative] = await db
    .select()
    .from(creatives)
    .where(and(eq(creatives.id, id), eq(creatives.campaignId, campaignId)))
  if (!creative) throw new NotFoundError("creative")
  return creative
}

// ── update ──────────────────────────────────────────────────────────────────

export async function update(campaignId: string, id: string, input: UpdateCreativeInput) {
  const db = getDb()
  const [updated] = await db
    .update(creatives)
    .set(input as never)
    .where(and(eq(creatives.id, id), eq(creatives.campaignId, campaignId)))
    .returning()
  if (!updated) throw new NotFoundError("creative")
  return updated
}

// ── delete ──────────────────────────────────────────────────────────────────

export async function remove(campaignId: string, id: string) {
  const db = getDb()
  try {
    const [deleted] = await db
      .delete(creatives)
      .where(and(eq(creatives.id, id), eq(creatives.campaignId, campaignId)))
      .returning()
    if (!deleted) throw new NotFoundError("creative")
    return deleted
  } catch (err) {
    // impressions FK is ON DELETE RESTRICT
    if (pgErrorCode(err) === "23503") {
      throw new ConflictError("creative_has_impressions", { hint: "deactivate_instead" })
    }
    throw err
  }
}
