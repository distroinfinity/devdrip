import type { ImpressionResult, NewsSource } from "@devdrip/shared"
import { getDb } from "../db/index.js"
import { newsImpressions } from "../db/schema/news_impressions.js"

// hard guarantee: no imports from earnings.service / budget / frequency / beacon.
// the absence of those imports IS the structural earnings-isolation guarantee.

export interface RecordNewsImpressionInput {
  userId: string
  deviceId: string
  newsId: string // "hn:38291043"
  source: NewsSource
  durationMs: number
  result: ImpressionResult
  openedUrl: boolean
  saved: boolean
}

export async function recordNewsImpression(input: RecordNewsImpressionInput) {
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
    })
    .returning()
  if (!row) throw new Error("news impression insert returned no rows")
  return row
}
