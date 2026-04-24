import { Router } from "express"
import { ImpressionResult, MAX_AD_DURATION_MS, MIN_COMPLETED_DURATION_MS } from "@devdrip/shared"
import { validateIngest, type IngestItem } from "../validators/ingest.validators.js"
import * as impressionService from "../services/impression.service.js"
import {
  peekDeliveryToken,
  verifyDeliveryTokenForIngest,
  verifyDeliveryTokenForClick,
} from "../lib/ad-delivery.js"
import { machineLimiter } from "../middleware/rate-limit.js"
import { logger } from "../lib/logger.js"
import { invalidateEarningsSummary } from "../services/earnings.service.js"
import { ApiError } from "../errors/index.js"

export const ingestRouter: ReturnType<typeof Router> = Router()

// pre-handler: read deviceId off the first token for the machine limiter key.
// never throws; bad tokens fall through to per-item verification which returns
// proper per-item errors.
ingestRouter.use(async (req, res, next) => {
  try {
    const body = req.body as { impressions?: unknown[]; clicks?: unknown[] } | undefined
    const firstItem =
      (Array.isArray(body?.impressions) && body?.impressions[0]) ||
      (Array.isArray(body?.clicks) && body?.clicks[0]) ||
      null
    if (firstItem && typeof firstItem === "object") {
      const token = (firstItem as Record<string, unknown>)["deliveryToken"]
      if (typeof token === "string") {
        const claims = await peekDeliveryToken(token)
        res.locals["deviceId"] = claims.deviceId
      }
    }
  } catch {
    // silent — if peek fails, limiter gets no key and falls through.
  }
  next()
})

ingestRouter.use(machineLimiter)

interface ImpressionResultItem {
  ok: boolean
  deliveryToken: string
  impressionId?: string
  earnedAmount?: number
  result?: ImpressionResult
  error?: string
}

interface ClickResultItem {
  ok: boolean
  deliveryToken: string
  clickId?: string
  earningsDelta?: number
  error?: string
}

function deriveOutcome(
  issuedAt: number,
  graceAccept: boolean,
  nowMs = Date.now()
): { durationMs: number; result: ImpressionResult } {
  if (graceAccept) {
    return { durationMs: MAX_AD_DURATION_MS, result: ImpressionResult.Expired }
  }
  const elapsedMs = Math.max(0, nowMs - issuedAt * 1000)
  const durationMs = Math.min(elapsedMs, MAX_AD_DURATION_MS)
  if (elapsedMs > MAX_AD_DURATION_MS) {
    return { durationMs, result: ImpressionResult.Expired }
  }
  if (durationMs >= MIN_COMPLETED_DURATION_MS) {
    return { durationMs, result: ImpressionResult.Completed }
  }
  return { durationMs, result: ImpressionResult.Skipped }
}

ingestRouter.post("/", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const input = validateIngest(req.body)

    const impressionResults: ImpressionResultItem[] = []
    const jtiToImpressionId = new Map<string, string>()

    for (const item of input.impressions) {
      const out = await ingestOneImpression(item, userId, jtiToImpressionId)
      impressionResults.push(out)
    }

    const clickResults: ClickResultItem[] = []
    for (const item of input.clicks) {
      const out = await ingestOneClick(item, userId, jtiToImpressionId)
      clickResults.push(out)
    }

    // best-effort: drop the user's earnings cache so the dashboard sees writes
    // promptly. failure to invalidate is harmless (60s natural TTL).
    invalidateEarningsSummary(userId).catch((err) => {
      logger.warn({ err, userId }, "earnings summary invalidation failed")
    })

    res.status(200).json({ impressions: impressionResults, clicks: clickResults })
  } catch (err) {
    next(err)
  }
})

async function ingestOneImpression(
  item: IngestItem,
  userId: string,
  jtiMap: Map<string, string>
): Promise<ImpressionResultItem> {
  try {
    const { claims, graceAccept } = await verifyDeliveryTokenForIngest(item.deliveryToken, userId)
    const outcome = deriveOutcome(claims.issuedAt, graceAccept)

    const impression = await impressionService.recordImpression({
      creativeId: claims.creativeId,
      deviceId: claims.deviceId,
      userId: claims.userId,
      surface: claims.surface,
      durationMs: outcome.durationMs,
      result: outcome.result,
      deliveryJti: claims.jti,
    })
    jtiMap.set(claims.jti, impression.id)
    return {
      ok: true,
      deliveryToken: item.deliveryToken,
      impressionId: impression.id,
      earnedAmount: impression.earnedAmount,
      result: outcome.result,
    }
  } catch (err) {
    return { ok: false, deliveryToken: item.deliveryToken, error: errorCode(err) }
  }
}

async function ingestOneClick(
  item: IngestItem,
  userId: string,
  jtiMap: Map<string, string>
): Promise<ClickResultItem> {
  try {
    const claims = await verifyDeliveryTokenForClick(item.deliveryToken, userId)
    const resolvedImpressionId = jtiMap.get(claims.jti)
    const result = await impressionService.recordClickByJti(
      claims.jti,
      userId,
      resolvedImpressionId
    )
    return {
      ok: true,
      deliveryToken: item.deliveryToken,
      clickId: result.clickId,
      earningsDelta: result.earningsDelta,
    }
  } catch (err) {
    return { ok: false, deliveryToken: item.deliveryToken, error: errorCode(err) }
  }
}

function errorCode(err: unknown): string {
  if (err instanceof ApiError) return err.errorCode
  if (err instanceof Error) return err.message.slice(0, 120)
  return "internal_error"
}
