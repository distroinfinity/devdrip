import type { SponsoredPayload } from "@distrotv/shared"
import type { ImpressionResult, LocalImpression } from "./ledger.js"

export interface IngestImpressionItem {
  deliveryToken: string
  durationMs: number
  result: string
}

export function buildAdImpression(args: {
  id: string
  slot: SponsoredPayload
  shownAt: number
  durationMs: number
  result: ImpressionResult
  deviceId: string
}): LocalImpression {
  return {
    id: args.id,
    adId: args.slot.adId,
    campaignId: args.slot.source,
    surface: "terminal-tv",
    source: args.slot.source,
    deliveryToken: args.slot.deliveryId,
    startedAt: args.shownAt,
    durationMs: args.durationMs,
    result: args.result,
    deviceId: args.deviceId,
    cpmRate: args.slot.cpmRate,
  }
}

// user + device come from the server-side delivery row, so only the view facts go up
export function toIngestImpression(row: LocalImpression): IngestImpressionItem {
  return { deliveryToken: row.deliveryToken, durationMs: row.durationMs, result: row.result }
}
