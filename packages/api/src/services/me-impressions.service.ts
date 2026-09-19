import { eq, inArray, sql } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { devices } from "../db/schema/devices.js"
import { impressions } from "../db/schema/impressions.js"
import { clicks } from "../db/schema/clicks.js"
import { creatives } from "../db/schema/creatives.js"
import { campaigns } from "../db/schema/campaigns.js"
import { advertisers } from "../db/schema/advertisers.js"
import { ForbiddenError, NotFoundError, ValidationError } from "../errors/index.js"

export interface ListImpressionsFilters {
  from?: Date
  to?: Date
  source?: string
  result?: string
  category?: string
  limit: number
  cursor?: { createdAt: Date; id: string }
}

export interface ImpressionListItem {
  id: string
  createdAt: string
  source: string
  surface: string
  durationMs: number
  result: string
  earnedAmount: number
  cpmRate: number
  category: string | null
  campaignName: string | null
  advertiserName: string | null
  hasClick: boolean
}

export interface ListImpressionsResult {
  items: ImpressionListItem[]
  nextCursor: string | null
}

export const LIST_LIMIT_DEFAULT = 50
export const LIST_LIMIT_MAX = 200
export const CSV_LIMIT = 5_000

async function userDeviceIds(userId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ id: devices.id })
    .from(devices)
    .where(eq(devices.userId, userId))
  return rows.map((r) => r.id)
}

function buildConds(deviceIds: string[], filters: ListImpressionsFilters) {
  const conds: ReturnType<typeof sql>[] = [inArray(impressions.deviceId, deviceIds)]
  if (filters.from) conds.push(sql`${impressions.createdAt} >= ${filters.from.toISOString()}`)
  if (filters.to) conds.push(sql`${impressions.createdAt} <= ${filters.to.toISOString()}`)
  if (filters.source) conds.push(sql`${impressions.source} = ${filters.source}`)
  if (filters.result) conds.push(sql`${impressions.result} = ${filters.result}`)
  if (filters.category) conds.push(sql`${creatives.category} = ${filters.category}`)
  if (filters.cursor) {
    // keyset: next page = rows strictly older than (createdAt, id)
    conds.push(
      sql`(${impressions.createdAt}, ${impressions.id}) < (${filters.cursor.createdAt.toISOString()}, ${filters.cursor.id})`
    )
  }
  return conds
}

export async function listUserImpressions(
  userId: string,
  filters: ListImpressionsFilters
): Promise<ListImpressionsResult> {
  const deviceIds = await userDeviceIds(userId)
  if (deviceIds.length === 0) return { items: [], nextCursor: null }

  const limit = Math.min(Math.max(filters.limit, 1), LIST_LIMIT_MAX)
  const conds = buildConds(deviceIds, filters)
  const where = sql.join(conds, sql` and `)
  const db = getDb()

  const rows = await db
    .select({
      id: impressions.id,
      createdAt: impressions.createdAt,
      source: impressions.source,
      surface: impressions.surface,
      durationMs: impressions.durationMs,
      result: impressions.result,
      earnedAmount: impressions.earnedAmount,
      cpmRate: impressions.cpmRate,
      category: creatives.category,
      campaignName: campaigns.name,
      advertiserName: advertisers.name,
      hasClick: sql<boolean>`${clicks.id} is not null`,
    })
    .from(impressions)
    .leftJoin(creatives, eq(creatives.id, impressions.creativeId))
    .leftJoin(campaigns, eq(campaigns.id, creatives.campaignId))
    .leftJoin(advertisers, eq(advertisers.id, campaigns.advertiserId))
    .leftJoin(clicks, eq(clicks.impressionId, impressions.id))
    .where(where)
    .orderBy(sql`${impressions.createdAt} desc, ${impressions.id} desc`)
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const sliced = hasMore ? rows.slice(0, limit) : rows
  const last = sliced[sliced.length - 1]
  const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null

  return {
    items: sliced.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      source: r.source as string,
      surface: r.surface as string,
      durationMs: r.durationMs,
      result: r.result as string,
      earnedAmount: Number(r.earnedAmount),
      cpmRate: Number(r.cpmRate),
      category: (r.category as string | null) ?? null,
      campaignName: r.campaignName ?? null,
      advertiserName: r.advertiserName ?? null,
      hasClick: Boolean(r.hasClick),
    })),
    nextCursor,
  }
}

export interface ImpressionDetail extends ImpressionListItem {
  deliveryJti: string | null
  creative: {
    headline: string
    body: string | null
    ctaText: string | null
    ctaUrl: string | null
    format: string
  } | null
  click: { createdAt: string } | null
}

export async function getUserImpressionDetail(
  userId: string,
  impressionId: string
): Promise<ImpressionDetail> {
  const db = getDb()
  const [row] = await db
    .select({
      id: impressions.id,
      createdAt: impressions.createdAt,
      source: impressions.source,
      surface: impressions.surface,
      durationMs: impressions.durationMs,
      result: impressions.result,
      earnedAmount: impressions.earnedAmount,
      cpmRate: impressions.cpmRate,
      deliveryJti: impressions.deliveryJti,
      deviceUserId: devices.userId,
      category: creatives.category,
      headline: creatives.headline,
      body: creatives.body,
      ctaText: creatives.ctaText,
      ctaUrl: creatives.ctaUrl,
      format: creatives.format,
      campaignName: campaigns.name,
      advertiserName: advertisers.name,
      clickAt: clicks.createdAt,
    })
    .from(impressions)
    .innerJoin(devices, eq(devices.id, impressions.deviceId))
    .leftJoin(creatives, eq(creatives.id, impressions.creativeId))
    .leftJoin(campaigns, eq(campaigns.id, creatives.campaignId))
    .leftJoin(advertisers, eq(advertisers.id, campaigns.advertiserId))
    .leftJoin(clicks, eq(clicks.impressionId, impressions.id))
    .where(eq(impressions.id, impressionId))
    .limit(1)

  if (!row) throw new NotFoundError("impression")
  if (row.deviceUserId !== userId) throw new ForbiddenError("not_owned")

  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    source: row.source as string,
    surface: row.surface as string,
    durationMs: row.durationMs,
    result: row.result as string,
    earnedAmount: Number(row.earnedAmount),
    cpmRate: Number(row.cpmRate),
    category: (row.category as string | null) ?? null,
    campaignName: row.campaignName ?? null,
    advertiserName: row.advertiserName ?? null,
    hasClick: row.clickAt !== null,
    deliveryJti: row.deliveryJti,
    creative: row.headline
      ? {
          headline: row.headline,
          body: row.body ?? null,
          ctaText: row.ctaText ?? null,
          ctaUrl: row.ctaUrl ?? null,
          format: (row.format as string) ?? "text",
        }
      : null,
    click: row.clickAt ? { createdAt: row.clickAt.toISOString() } : null,
  }
}

export async function listUserImpressionsForCsv(
  userId: string,
  filters: Omit<ListImpressionsFilters, "limit" | "cursor">
): Promise<ImpressionListItem[]> {
  const result = await listUserImpressions(userId, {
    ...filters,
    limit: CSV_LIMIT,
  })
  return result.items
}

// ── cursor encoding ────────────────────────────────────────────────────────

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString("base64url")
}

export function decodeCursor(raw: string): { createdAt: Date; id: string } {
  let decoded: string
  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8")
  } catch {
    throw new ValidationError("invalid_cursor")
  }
  const [iso, id] = decoded.split("|")
  if (!iso || !id) throw new ValidationError("invalid_cursor")
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) throw new ValidationError("invalid_cursor")
  return { createdAt: d, id }
}
