import { randomUUID } from "node:crypto"
import type { SponsoredPayload } from "@distrotv/shared"
import { env } from "../config/env.js"
import { getDb } from "../db/index.js"
import { adImpressions } from "../db/schema/ad_impressions.js"
import { logger } from "../lib/logger.js"
import { displayLabel, fetchCarbonAd } from "./carbon-ad.provider.js"
import { clickCode } from "./ad-impression.service.js"
import { houseAd } from "./house-ads.js"

let houseCursor = 0

// picks n ads and records each as a "pending" delivery row. never throws — ad
// supply must not fail content serving; on any error the caller just gets no ads.
export async function nextAds(args: {
  userId: string
  deviceId: string
  n: number
}): Promise<SponsoredPayload[]> {
  if (args.n <= 0) return []
  try {
    const carbon = await fetchCarbonAd()
    const cpmRate = env.adCpmRate
    const picked = Array.from({ length: args.n }, (_, i) => ({
      // carbon fills the first slot of a batch; house ads give the rest variety
      ad: i === 0 && carbon ? carbon : houseAd(houseCursor++),
      deliveryId: randomUUID(),
    }))

    await getDb()
      .insert(adImpressions)
      .values(
        picked.map(({ ad, deliveryId }) => ({
          userId: args.userId,
          deviceId: args.deviceId,
          deliveryId,
          adId: ad.adId,
          source: ad.source,
          advertiser: ad.advertiser,
          headline: ad.headline,
          targetUrl: ad.targetUrl,
          clickBeaconUrl: ad.clickBeaconUrl,
          viewBeaconUrl: ad.viewBeaconUrl,
          cpmRate: String(cpmRate),
        }))
      )

    return picked.map(({ ad, deliveryId }) => ({
      kind: "sponsored",
      adId: ad.adId,
      source: ad.source,
      advertiser: ad.advertiser,
      headline: ad.headline,
      ctaText: ad.ctaText,
      displayUrl: displayLabel(ad.targetUrl, ad.advertiser),
      // short form so the terminal can print it as a cmd-clickable url
      clickUrl: `${env.apiUrl}/c/${clickCode(deliveryId)}`,
      deliveryId,
      cpmRate,
    }))
  } catch (err) {
    logger.warn({ err }, "ad supply failed")
    return []
  }
}
