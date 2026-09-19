import { createHash } from "node:crypto"
import { fetchAd } from "@carbonads/sdk"
import { env } from "../config/env.js"
import { logger } from "../lib/logger.js"

export interface NormalizedAd {
  adId: string
  source: "carbon" | "house" | "direct"
  advertiser: string
  headline: string
  ctaText: string
  targetUrl: string
  // network tracking urls; null when there is nothing extra to fire
  clickBeaconUrl: string | null
  viewBeaconUrl: string | null
}

export interface CarbonAdLike {
  company?: string
  companyTagline?: string
  description?: string
  link?: string
  statlink?: string
  statviewUrl?: string
  callToAction?: string
}

const FETCH_TIMEOUT_MS = 3_000
const CACHE_TTL_MS = 60_000
const TRACKER_HOSTS = ["carbonads.net", "buysellads.com", "buysellads.net"]

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…"
}

function httpUrl(u: string | undefined): string | null {
  if (!u) return null
  try {
    const p = new URL(u.startsWith("//") ? `https:${u}` : u)
    return p.protocol === "https:" || p.protocol === "http:" ? p.toString() : null
  } catch {
    return null
  }
}

// short link label: bare host, or the advertiser name when the url is an ad-network tracker
export function displayLabel(url: string, advertiser: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "")
    if (!host || TRACKER_HOSTS.some((t) => host === t || host.endsWith(`.${t}`))) return advertiser
    return host
  } catch {
    return advertiser
  }
}

export function mapCarbonAd(ad: CarbonAdLike): NormalizedAd | null {
  if (!ad.description) return null
  const statlink = httpUrl(ad.statlink)
  const targetUrl = httpUrl(ad.link) ?? statlink
  if (!targetUrl) return null
  const hash = createHash("sha256")
    .update(`${ad.company ?? ""}:${ad.description}:${ad.statlink ?? ""}`)
    .digest("hex")
    .slice(0, 32)
  return {
    adId: `carbon:${hash}`,
    source: "carbon",
    advertiser: truncate(ad.company || ad.companyTagline || "Sponsored", 60),
    headline: truncate(ad.description, 140),
    ctaText: truncate(ad.callToAction || "Learn more", 30),
    targetUrl,
    // when the landing link already is the statlink, the redirect itself counts the click
    clickBeaconUrl: statlink && statlink !== targetUrl ? statlink : null,
    viewBeaconUrl: httpUrl(ad.statviewUrl),
  }
}

export interface PooledAd {
  ad: NormalizedAd
  at: number
}

const POOL_TTL_MS = 30 * 60_000
const POOL_MAX = 8
const FETCHES_PER_REFRESH = 3

// distinct ads seen recently, oldest first. carbon returns one ad per call and rotates
// its inventory, so a few calls a minute build a small, varied pool.
export function mergeCarbonPool(pool: PooledAd[], fresh: NormalizedAd[], now: number): PooledAd[] {
  const byId = new Map<string, PooledAd>()
  for (const p of pool) if (now - p.at < POOL_TTL_MS) byId.set(p.ad.adId, p)
  for (const ad of fresh) {
    // a re-seen ad keeps its place but has its clock reset
    const existing = byId.get(ad.adId)
    if (existing) existing.at = now
    else byId.set(ad.adId, { ad, at: now })
  }
  return [...byId.values()].slice(-POOL_MAX)
}

let pool: PooledAd[] = []
let lastRefreshAt = 0

async function fetchOne(): Promise<NormalizedAd | null> {
  const opts: { placement: string; serve?: string } = { placement: env.carbonPlacement }
  if (env.carbonZoneKey) opts.serve = env.carbonZoneKey
  const raw = await Promise.race([
    fetchAd(opts),
    new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error("carbon_fetch_timeout")), FETCH_TIMEOUT_MS)
    ),
  ])
  return raw ? mapCarbonAd(raw as CarbonAdLike) : null
}

// never throws. refreshes at most once a minute, so /me/content/next doesn't hit carbon
// per request; between refreshes it serves what is already in the pool.
export async function getCarbonAds(): Promise<NormalizedAd[]> {
  if (!env.carbonEnabled) return []
  const now = Date.now()
  if (now - lastRefreshAt >= CACHE_TTL_MS) {
    lastRefreshAt = now
    const results = await Promise.allSettled(
      Array.from({ length: FETCHES_PER_REFRESH }, () => fetchOne())
    )
    const fresh: NormalizedAd[] = []
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) fresh.push(r.value)
      else if (r.status === "rejected") logger.warn({ err: r.reason }, "carbon ad fetch failed")
    }
    pool = mergeCarbonPool(pool, fresh, now)
  }
  return pool.map((p) => p.ad)
}
