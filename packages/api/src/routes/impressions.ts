import { Router } from "express"
import { ImpressionResult, MAX_AD_DURATION_MS, MIN_COMPLETED_DURATION_MS } from "@devdrip/shared"
import { validateRecordImpression } from "../validators/ad.validators.js"
import * as impressionService from "../services/impression.service.js"
import { consumeDeliveryToken } from "../lib/ad-delivery.js"

export const impressionsRouter: ReturnType<typeof Router> = Router()

interface ImpressionOutcome {
  durationMs: number
  result: ImpressionResult
}

// The client only acknowledges a served ad; the server derives the billable
// outcome from the token issue time so the request body cannot choose it.
export function deriveImpressionOutcome(issuedAt: number, nowMs = Date.now()): ImpressionOutcome {
  const elapsedMs = Math.max(0, nowMs - issuedAt * 1000)
  const durationMs = Math.min(elapsedMs, MAX_AD_DURATION_MS)

  if (elapsedMs > MAX_AD_DURATION_MS) {
    return {
      durationMs,
      result: ImpressionResult.Expired,
    }
  }

  if (durationMs >= MIN_COMPLETED_DURATION_MS) {
    return {
      durationMs,
      result: ImpressionResult.Completed,
    }
  }

  return {
    durationMs,
    result: ImpressionResult.Skipped,
  }
}

// ── POST /impressions ──────────────────────────────────────────────────────

impressionsRouter.post("/", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const input = validateRecordImpression(req.body)
    const delivery = await consumeDeliveryToken(input.deliveryToken, userId)
    const outcome = deriveImpressionOutcome(delivery.issuedAt)

    const impression = await impressionService.recordImpression({
      creativeId: delivery.creativeId,
      deviceId: delivery.deviceId,
      userId: delivery.userId,
      surface: delivery.surface,
      durationMs: outcome.durationMs,
      result: outcome.result,
      deliveryJti: delivery.jti,
      graceAccept: false,
    })

    await res.status(201).json({ impression })
  } catch (err) {
    next(err)
  }
})
