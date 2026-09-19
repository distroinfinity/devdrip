import { randomUUID } from "node:crypto"
import type { SponsoredPayload } from "@distrotv/shared"
import { env } from "../config/env.js"
import { getDb } from "../db/index.js"
import { adImpressions } from "../db/schema/ad_impressions.js"
import { logger } from "../lib/logger.js"
import { displayLabel, fetchCarbonAd } from "./carbon-ad.provider.js"
import { clickCode } from "./ad-impression.service.js"
import { listActiveDirectAds, pickDirect } from "./advertiser-ads.service.js"
import type { NormalizedAd } from "./carbon-ad.provider.js"
import { houseAd } from "./house-ads.js"

let houseCursor = 0

// how much of a batch direct (advertiser-written) ads may take. the rest stays
// network + house fill so one advertiser can't own every slot.
const DIRECT_SHARE = 0.5

interface Picked {
  ad: NormalizedAd
  deliveryId: string
  cpmRate: number
}

// picks n ads and records each as a "pending" delivery row. never throws — ad
// supply must not fail content serving; on any error the caller just gets no ads.
// order of preference: direct ads (highest bid first), then carbon, then house.
export async function nextAds(args: {
  userId: string
  deviceId: string
  n: number
}): Promise<SponsoredPayload[]> {
  if (args.n <= 0) return []
  try {
    const [carbon, direct] = await Promise.all([
      fetchCarbonAd(),
      listActiveDirectAds().catch(() => []),
    ])
    const fillCpm = env.adCpmRate

    const directSlots = direct.length > 0 ? Math.max(1, Math.floor(args.n * DIRECT_SHARE)) : 0
    const directPicks = pickDirect(direct, directSlots)

    const picked: Picked[] = directPicks.map((d) => ({
      ad: {
        adId: `direct:${d.id}`,
        source: "direct" as const,
        advertiser: d.brand,
        headline: d.line,
        ctaText: "Learn more",
        targetUrl: d.url,
        clickBeaconUrl: null,
        viewBeaconUrl: null,
      },
      deliveryId: randomUUID(),
      // the advertiser's bid is the price of this impression
      cpmRate: d.bidCpm,
    }))

    // network fill: carbon takes the first free slot, house ads the rest
    let carbonLeft: NormalizedAd | null = carbon
    while (picked.length < args.n) {
      const ad: NormalizedAd = carbonLeft ?? houseAd(houseCursor++)
      carbonLeft = null
      picked.push({ ad, deliveryId: randomUUID(), cpmRate: fillCpm })
    }

    // interleave so a batch doesn't open with a run of the same kind
    const ordered = interleaveBySource(picked)

    await getDb()
      .insert(adImpressions)
      .values(
        ordered.map(({ ad, deliveryId, cpmRate }) => ({
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

    return ordered.map(({ ad, deliveryId, cpmRate }) => ({
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

// direct, fill, direct, fill… then whatever is left
function interleaveBySource(picked: Picked[]): Picked[] {
  const direct = picked.filter((p) => p.ad.source === "direct")
  const fill = picked.filter((p) => p.ad.source !== "direct")
  const out: Picked[] = []
  while (direct.length > 0 || fill.length > 0) {
    const d = direct.shift()
    if (d) out.push(d)
    const f = fill.shift()
    if (f) out.push(f)
  }
  return out
}
