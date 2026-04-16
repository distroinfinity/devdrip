import { createHash } from "node:crypto"
import { fetchAd, type CarbonAd } from "@carbonads/sdk"
import { sql } from "drizzle-orm"
import type { AdProvider, AdRequest, AdPayload } from "@devdrip/shared"
import { MAX_AD_DURATION_MS } from "@devdrip/shared"
import { env } from "../config/env.js"
import { getDb } from "../db/index.js"
import { creatives } from "../db/schema/creatives.js"
import { CARBON_CAMPAIGN_ID, ensureCarbonSystemCampaign } from "../lib/carbon-system-campaign.js"
import { logger } from "../lib/logger.js"

// ── helpers ────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 3_000

function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + "…"
}

function deriveExternalId(ad: CarbonAd): string {
  return createHash("sha256")
    .update(`${ad.company}:${ad.description}:${ad.statlink}`)
    .digest("hex")
    .slice(0, 32)
}

// ── fetch ads ──────────────────────────────────────────────────────────────

async function fetchAds(request: AdRequest): Promise<AdPayload[]> {
  if (!env.carbonZoneKey) return []

  let ad: CarbonAd | null

  try {
    ad = await Promise.race([
      fetchAd({ serve: env.carbonZoneKey, placement: env.carbonPlacement }),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("carbon_fetch_timeout")), FETCH_TIMEOUT_MS)
      ),
    ])
  } catch (err) {
    logger.warn({ err }, "carbon ad fetch failed")
    return []
  }

  if (!ad || !ad.description) return []

  await ensureCarbonSystemCampaign()

  const externalId = deriveExternalId(ad)
  const headline = truncate(ad.company || ad.companyTagline || "Sponsored", 60)
  const body = truncate(ad.description, 140)
  const ctaUrl = ad.link || ad.statlink || null
  const clickTrackingUrl = ad.statlink || null
  const viewabilityBeaconUrl = ad.statviewUrl || null

  const db = getDb()

  // upsert ephemeral creative — ON CONFLICT refreshes updated_at
  const [row] = await db
    .insert(creatives)
    .values({
      campaignId: CARBON_CAMPAIGN_ID,
      headline,
      body,
      ctaText: ad.callToAction ? truncate(ad.callToAction, 30) : "Learn More",
      ctaUrl,
      format: "text",
      surface: request.surface,
      category: "developer-tools",
      source: "carbon",
      cpmRate: env.carbonCpmRate,
      externalCreativeId: externalId,
      clickTrackingUrl,
      viewabilityBeaconUrl,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [creatives.source, creatives.externalCreativeId],
      set: {
        headline,
        body,
        ctaUrl,
        clickTrackingUrl,
        viewabilityBeaconUrl,
        surface: request.surface,
        cpmRate: env.carbonCpmRate,
        isActive: true,
        updatedAt: sql`now()`,
      },
    })
    .returning()

  if (!row) return []

  return [
    {
      id: row.id,
      campaignId: CARBON_CAMPAIGN_ID,
      format: "text",
      headline,
      body,
      url: ctaUrl ?? "",
      displayTimeMs: MAX_AD_DURATION_MS,
    },
  ]
}

// ── export ──────────────────────────────────────────────────────────────────

export const carbonAdProvider: AdProvider = {
  name: "carbon",
  fetchAds,
}
