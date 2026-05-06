import type { ImpressionResult, NewsSource } from "@distrotv/shared"
import { getDb } from "../db/index.js"
import { newsImpressions } from "../db/schema/news_impressions.js"

// hard guarantee: no imports from earnings.service / budget / frequency / beacon.
// the absence of those imports IS the structural earnings-isolation guarantee.

// local union until Batch 7 consolidates via @distrotv/shared SlotKind
export type SlotImpressionKind = "news" | "ticker" | "sponsored" | "portfolio"

export interface SlotImpressionInput {
  userId: string
  deviceId: string
  newsId: string // "hn:38291043"
  source: NewsSource
  durationMs: number
  result: ImpressionResult
  openedUrl: boolean
  saved: boolean
  kind: SlotImpressionKind // default "news"; Batch 5 adds kind column to DB
}

export async function recordSlotImpression(input: SlotImpressionInput) {
  const db = getDb()
  const [row] = await db
    .insert(newsImpressions)
    .values({
      userId: input.userId,
      deviceId: input.deviceId,
      newsId: input.newsId,
      source: input.source,
      durationMs: input.durationMs,
      result: input.result,
      openedUrl: input.openedUrl,
      saved: input.saved,
      // kind threaded through; Batch 5 adds the column — insert will fail until then
      // kind: input.kind,
    })
    .returning()
  if (!row) throw new Error("slot impression insert returned no rows")
  return row
}
