import { Router } from "express"
import type { ImpressionResult, NewsSource } from "@distrotv/shared"
import { recordSlotImpression } from "../services/slot-impression.service.js"
import { logger } from "../lib/logger.js"

interface RawNewsImpression {
  newsId?: unknown
  source?: unknown
  deviceId?: unknown
  durationMs?: unknown
  result?: unknown
  openedUrl?: unknown
  saved?: unknown
}

function parseNewsImpression(
  raw: RawNewsImpression
): {
  newsId: string
  source: string
  deviceId: string
  durationMs: number
  result: string
  openedUrl: boolean
  saved: boolean
} | null {
  if (
    typeof raw.newsId !== "string" ||
    typeof raw.source !== "string" ||
    typeof raw.deviceId !== "string" ||
    typeof raw.durationMs !== "number" ||
    typeof raw.result !== "string"
  ) {
    return null
  }
  return {
    newsId: raw.newsId,
    source: raw.source,
    deviceId: raw.deviceId,
    durationMs: raw.durationMs,
    result: raw.result,
    openedUrl: raw.openedUrl === true,
    saved: raw.saved === true,
  }
}

export const ingestRouter: ReturnType<typeof Router> = Router()

ingestRouter.post("/", async (req, res) => {
  const userId = res.locals["userId"] as string
  const body = req.body as {
    newsImpressions?: unknown[]
    impressions?: unknown[]
    clicks?: unknown[]
  }

  const rawNews = Array.isArray(body.newsImpressions) ? body.newsImpressions : []
  const rawImpressions = Array.isArray(body.impressions) ? body.impressions : []
  const rawClicks = Array.isArray(body.clicks) ? body.clicks : []

  const newsImpressionResults: { ok: boolean; newsId: string; error?: string }[] = []

  for (const raw of rawNews) {
    const ni = parseNewsImpression(raw as RawNewsImpression)
    if (!ni) {
      newsImpressionResults.push({
        ok: false,
        newsId: String((raw as RawNewsImpression).newsId ?? ""),
        error: "invalid_payload",
      })
      continue
    }
    try {
      await recordSlotImpression({
        userId,
        kind: "news",
        newsId: ni.newsId,
        source: ni.source as NewsSource,
        deviceId: ni.deviceId,
        durationMs: ni.durationMs,
        result: ni.result as ImpressionResult,
        openedUrl: ni.openedUrl,
        saved: ni.saved,
      })
      newsImpressionResults.push({ ok: true, newsId: ni.newsId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.warn({ err, newsId: ni.newsId }, "ingest: recordSlotImpression failed")
      newsImpressionResults.push({ ok: false, newsId: ni.newsId, error: msg })
    }
  }

  // return legacy empty arrays so CLI's applyResults loop doesn't throw on index access
  res.json({
    impressions: rawImpressions.map(() => ({ ok: false, deliveryToken: "" })),
    clicks: rawClicks.map(() => ({ ok: false, deliveryToken: "" })),
    newsImpressions: newsImpressionResults,
  })
})
