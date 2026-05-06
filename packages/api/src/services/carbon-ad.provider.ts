import { createHash } from "node:crypto"
import { fetchAd, type CarbonAd } from "@carbonads/sdk"
import { sql } from "drizzle-orm"
import type { AdProvider, AdRequest, AdPayload } from "@distrotv/shared"
import { MAX_AD_DURATION_MS } from "@distrotv/shared"
import { env } from "../config/env.js"
import { getDb } from "../db/index.js"
import { creatives } from "../db/schema/creatives.js"
import { CARBON_CAMPAIGN_ID } from "../lib/carbon-system-campaign.js"
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
  try {
    const fetchOptions: { serve?: string; placement: string } = {
      placement: env.carbonPlacement,
    }
    if (env.carbonZoneKey) {
      fetchOptions.serve = env.carbonZoneKey
    }

    const ad = await Promise.race([
      fetchAd(fetchOptions),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("carbon_fetch_timeout")), FETCH_TIMEOUT_MS)
      ),
    ])

    if (!ad || !ad.description) return []

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
        targetWhere: sql`${creatives.externalCreativeId} IS NOT NULL`,
        set: {
          headline,
          body,
          ctaUrl,
          clickTrackingUrl,
          viewabilityBeaconUrl,
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
        cpmRate: env.carbonCpmRate,
        // DB schema calls this viewabilityBeaconUrl; AdPayload calls it impressionBeaconUrl
        impressionBeaconUrl: viewabilityBeaconUrl ?? undefined,
        clickTrackingUrl: clickTrackingUrl ?? undefined,
      },
    ]
  } catch (err) {
    logger.warn({ err }, "carbon ad fetch failed")
    return []
  }
}

// ── export ──────────────────────────────────────────────────────────────────

export const carbonAdProvider: AdProvider = {
  name: "carbon",
  fetchAds,
}
