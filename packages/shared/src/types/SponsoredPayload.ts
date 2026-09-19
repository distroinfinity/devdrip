export type Feed = "ads" | "news" | "markets"

export interface SponsoredPayload {
  kind: "sponsored"
  // "carbon:<sha>" | "house:<slug>"
  adId: string
  source: "carbon" | "house"
  advertiser: string
  headline: string
  ctaText: string
  // short label for the link, e.g. "sentry.io" (advertiser name when the host is a tracker)
  displayUrl: string
  // our redirect: {apiUrl}/ads/click/{deliveryId}
  clickUrl: string
  // opaque uuid, one per served ad
  deliveryId: string
  // estimated usd cpm
  cpmRate: number
}
