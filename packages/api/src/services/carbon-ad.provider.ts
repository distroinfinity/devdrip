import { createHash } from "node:crypto"
import { fetchAd } from "@carbonads/sdk"
import { env } from "../config/env.js"
import { logger } from "../lib/logger.js"

export interface NormalizedAd {
  adId: string
  source: "carbon" | "house"
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

let cached: { at: number; ad: NormalizedAd | null } | null = null

// never throws. 60s in-process cache so /me/content/next doesn't hit carbon per request.
export async function fetchCarbonAd(): Promise<NormalizedAd | null> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.ad
  try {
    const opts: { placement: string; serve?: string } = { placement: env.carbonPlacement }
    if (env.carbonZoneKey) opts.serve = env.carbonZoneKey
    const raw = await Promise.race([
      fetchAd(opts),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("carbon_fetch_timeout")), FETCH_TIMEOUT_MS)
      ),
    ])
    const ad = raw ? mapCarbonAd(raw as CarbonAdLike) : null
    cached = { at: Date.now(), ad }
    return ad
  } catch (err) {
    logger.warn({ err }, "carbon ad fetch failed")
    cached = { at: Date.now(), ad: null }
    return null
  }
}
