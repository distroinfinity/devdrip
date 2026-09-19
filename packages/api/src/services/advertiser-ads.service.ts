import { and, desc, eq, sql } from "drizzle-orm"
import { env } from "../config/env.js"
import { getDb } from "../db/index.js"
import { adCampaigns } from "../db/schema/ad_campaigns.js"
import { adImpressions } from "../db/schema/ad_impressions.js"

export type AdStatus = "active" | "paused" | "review"
export type NewAdError = "invalid_brand" | "invalid_line" | "invalid_url" | "invalid_bid"

export interface NewAd {
  brand: string
  line: string
  url: string
  bidCpm: number
}

export const MAX_ADS_PER_USER = 10
const DEFAULT_BID = 10

// ad copy ends up in other people's terminals: drop escape sequences and control
// bytes, collapse whitespace. (the cli strips again at render time.)
function cleanText(v: unknown): string {
  if (typeof v !== "string") return ""
  return v
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, "")
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function httpsUrl(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 2048) return null
  try {
    const u = new URL(v.trim())
    if (u.protocol !== "https:" || u.username || u.password) return null
    // a real public host: has a dot, is not localhost or a bare ip-ish label
    if (!u.hostname.includes(".") || u.hostname.endsWith(".local")) return null
    return u.toString()
  } catch {
    return null
  }
}

export function parseNewAd(
  raw: unknown
): { ok: true; ad: NewAd } | { ok: false; error: NewAdError } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const brand = cleanText(r["brand"])
  if (brand.length < 2 || brand.length > 40) return { ok: false, error: "invalid_brand" }
  const line = cleanText(r["line"])
  if (line.length < 10 || line.length > 140) return { ok: false, error: "invalid_line" }
  const url = httpsUrl(r["url"])
  if (!url) return { ok: false, error: "invalid_url" }
  const bidRaw = r["bidCpm"]
  const bidCpm = bidRaw === undefined ? DEFAULT_BID : bidRaw
  if (typeof bidCpm !== "number" || !Number.isFinite(bidCpm) || bidCpm < 1 || bidCpm > 100) {
    return { ok: false, error: "invalid_bid" }
  }
  // keep what the advertiser typed for the link, minus surrounding whitespace
  return { ok: true, ad: { brand, line, url: String(r["url"]).trim(), bidCpm } }
}

// fills n slots from the top of the book: highest bid first, older ad first on a tie,
// wrapping round when there are more slots than ads. every batch starts from the top,
// so a higher bid always leads and never gets fewer slots than a lower one.
export function pickDirect<T extends { bidCpm: number; createdAt: number }>(
  ads: T[],
  n: number
): T[] {
  if (n <= 0 || ads.length === 0) return []
  const ordered = [...ads].sort((a, b) => b.bidCpm - a.bidCpm || a.createdAt - b.createdAt)
  const out: T[] = []
  for (let i = 0; i < n; i++) {
    const ad = ordered[i % ordered.length]
    if (ad) out.push(ad)
  }
  return out
}

export interface ActiveDirectAd {
  id: string
  brand: string
  line: string
  url: string
  bidCpm: number
  createdAt: number
}

export async function listActiveDirectAds(): Promise<ActiveDirectAd[]> {
  const rows = await getDb()
    .select()
    .from(adCampaigns)
    .where(eq(adCampaigns.status, "active"))
    .limit(200)
  return rows.map((r) => ({
    id: r.id,
    brand: r.brand,
    line: r.line,
    url: r.url,
    bidCpm: Number(r.bidCpm),
    createdAt: r.createdAt.getTime(),
  }))
}

type CampaignRow = typeof adCampaigns.$inferSelect

interface AdStats {
  served: number
  views: number
  clicks: number
  ctr: number
  spend: number
}

function shape(row: CampaignRow, stats: AdStats) {
  return {
    id: row.id,
    brand: row.brand,
    line: row.line,
    url: row.url,
    bidCpm: Number(row.bidCpm),
    status: row.status as AdStatus,
    createdAt: row.createdAt.toISOString(),
    stats,
  }
}

const NO_STATS: AdStats = { served: 0, views: 0, clicks: 0, ctr: 0, spend: 0 }

// per-ad delivery numbers, straight from the impression rows. spend is what the
// paid views would cost at the ad's bid — estimated, nothing is charged in the pilot.
async function statsFor(ids: string[]): Promise<Map<string, AdStats>> {
  const out = new Map<string, AdStats>()
  if (ids.length === 0) return out
  const keys = ids.map((id) => `direct:${id}`)
  const rows = await getDb()
    .select({
      adId: adImpressions.adId,
      served: sql<number>`count(*)::int`,
      views: sql<number>`(count(*) filter (where ${adImpressions.result} <> 'pending'))::int`,
      clicks: sql<number>`(count(*) filter (where ${adImpressions.clicked}))::int`,
      spend: sql<string>`coalesce(sum(${adImpressions.cpmRate} / 1000) filter (where ${adImpressions.earnedAmount} > 0), 0)`,
    })
    .from(adImpressions)
    .where(sql`${adImpressions.adId} in ${keys}`)
    .groupBy(adImpressions.adId)
  for (const r of rows) {
    out.set(r.adId.replace(/^direct:/, ""), {
      served: r.served,
      views: r.views,
      clicks: r.clicks,
      ctr: r.views > 0 ? r.clicks / r.views : 0,
      spend: Number(r.spend),
    })
  }
  return out
}

export async function listMyAds(userId: string) {
  const rows = await getDb()
    .select()
    .from(adCampaigns)
    .where(eq(adCampaigns.ownerUserId, userId))
    .orderBy(desc(adCampaigns.createdAt))
    .limit(50)
  const stats = await statsFor(rows.map((r) => r.id))
  return rows.map((r) => shape(r, stats.get(r.id) ?? NO_STATS))
}

export async function createAd(userId: string, ad: NewAd) {
  const db = getDb()
  const [count] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(adCampaigns)
    .where(eq(adCampaigns.ownerUserId, userId))
  if ((count?.n ?? 0) >= MAX_ADS_PER_USER) return { error: "too_many_ads" as const }
  const [row] = await db
    .insert(adCampaigns)
    .values({
      ownerUserId: userId,
      brand: ad.brand,
      line: ad.line,
      url: ad.url,
      bidCpm: String(ad.bidCpm),
      // auto-approve is a local/demo convenience; production must review first
      status: env.adAutoApprove ? "active" : "review",
    })
    .returning()
  if (!row) throw new Error("ad_insert_failed")
  return { ad: shape(row, NO_STATS) }
}

export async function setAdStatus(userId: string, id: string, status: "active" | "paused") {
  const db = getDb()
  const [existing] = await db
    .select()
    .from(adCampaigns)
    .where(and(eq(adCampaigns.id, id), eq(adCampaigns.ownerUserId, userId)))
    .limit(1)
  if (!existing) return { error: "not_found" as const }
  // an advertiser can pause and resume, but cannot approve their own ad
  if (existing.status === "review") return { error: "in_review" as const }
  const [row] = await db
    .update(adCampaigns)
    .set({ status, updatedAt: sql`now()` })
    .where(and(eq(adCampaigns.id, id), eq(adCampaigns.ownerUserId, userId)))
    .returning()
  if (!row) return { error: "not_found" as const }
  const stats = await statsFor([row.id])
  return { ad: shape(row, stats.get(row.id) ?? NO_STATS) }
}
