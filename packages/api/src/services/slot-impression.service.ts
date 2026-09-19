import type { ImpressionResult, NewsSource, SlotKind } from "@distrotv/shared"
import { getDb } from "../db/index.js"
import { slotImpressions } from "../db/schema/slot_impressions.js"
import { markServedOnImpression } from "./news-selection.service.js"
import { logger } from "../lib/logger.js"

// hard guarantee: no imports from earnings.service / budget / frequency / beacon.
// the absence of those imports IS the structural earnings-isolation guarantee.

export interface SlotImpressionInput {
  userId: string
  deviceId: string
  newsId: string // "hn:38291043"
  source: NewsSource
  durationMs: number
  result: ImpressionResult
  openedUrl: boolean
  saved: boolean
  kind: SlotKind // default "news"
}

export async function recordSlotImpression(input: SlotImpressionInput) {
  const db = getDb()
  const [row] = await db
    .insert(slotImpressions)
    .values({
      userId: input.userId,
      deviceId: input.deviceId,
      newsId: input.newsId,
      source: input.source,
      durationMs: input.durationMs,
      result: input.result,
      openedUrl: input.openedUrl,
      saved: input.saved,
      kind: input.kind,
    })
    .returning()
  if (!row) throw new Error("slot impression insert returned no rows")

  // advance the per-device served set so we don't repeat this item.
  // best-effort: redis hiccups must never fail an impression POST.
  if (input.kind === "news" && input.durationMs > 0) {
    try {
      await markServedOnImpression(input.deviceId, input.newsId)
    } catch (err) {
      logger.warn({ err: String(err), newsId: input.newsId }, "markServedOnImpression failed")
    }
  }
  return row
}
