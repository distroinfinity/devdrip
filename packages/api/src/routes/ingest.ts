import { Router } from "express"
import type { ImpressionResult, NewsSource } from "@distrotv/shared"
import { recordSlotImpression } from "../services/slot-impression.service.js"
import { markServedOnImpression } from "../services/news-selection.service.js"
import { parseAdImpression, recordAdImpression } from "../services/ad-impression.service.js"
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

function parseNewsImpression(raw: RawNewsImpression): {
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
  // collect rendered news IDs per device so the served-set advance is one
  // SADD+EXPIRE per device per batch, not two Redis ops per impression.
  const servedByDevice = new Map<string, string[]>()

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
      // only items that actually rendered (durationMs > 0) advance the served set
      if (ni.durationMs > 0) {
        const ids = servedByDevice.get(ni.deviceId) ?? []
        ids.push(ni.newsId)
        servedByDevice.set(ni.deviceId, ids)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.warn({ err, newsId: ni.newsId }, "ingest: recordSlotImpression failed")
      newsImpressionResults.push({ ok: false, newsId: ni.newsId, error: msg })
    }
  }

  // best-effort served-set advance — redis hiccups must never fail an ingest.
  for (const [deviceId, ids] of servedByDevice) {
    try {
      await markServedOnImpression(deviceId, ids)
    } catch (err) {
      logger.warn({ err, deviceId }, "ingest: markServedOnImpression failed")
    }
  }

  // ad impressions: index-aligned results. the two error strings are in the cli's
  // terminal set, so a bad row is tombstoned instead of retried forever.
  const impressionResults: { ok: boolean; deliveryToken: string; error?: string }[] = []
  for (const raw of rawImpressions) {
    const token = String((raw as { deliveryToken?: unknown } | null)?.deliveryToken ?? "")
    const input = parseAdImpression(raw)
    if (!input) {
      impressionResults.push({
        ok: false,
        deliveryToken: token,
        error: "invalid_or_expired_delivery_token",
      })
      continue
    }
    try {
      const outcome = await recordAdImpression({ userId, input })
      impressionResults.push(
        outcome === "ok"
          ? { ok: true, deliveryToken: token }
          : { ok: false, deliveryToken: token, error: outcome }
      )
    } catch (err) {
      logger.warn({ err }, "ingest: recordAdImpression failed")
      // no error code → the cli treats it as transient and retries
      impressionResults.push({ ok: false, deliveryToken: token })
    }
  }

  // clicks are recorded by GET /ads/click/:deliveryId, not ingested; the array
  // stays in the response so older clients' result loop keeps working.
  res.json({
    impressions: impressionResults,
    clicks: rawClicks.map(() => ({ ok: false, deliveryToken: "" })),
    newsImpressions: newsImpressionResults,
  })
})
