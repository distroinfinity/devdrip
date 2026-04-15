import { Router } from "express"
import type { ImpressionResult } from "@devdrip/shared"
import { MIN_COMPLETED_DURATION_MS, IMPRESSION_CLOCK_TOLERANCE_MS } from "@devdrip/shared"
import { validateRecordImpression } from "../validators/ad.validators.js"
import * as impressionService from "../services/impression.service.js"
import { consumeDeliveryToken } from "../lib/ad-delivery.js"
import { ValidationError } from "../errors/index.js"

export const impressionsRouter: ReturnType<typeof Router> = Router()

// ── duration bounds ────────────────────────────────────────────────────────
// server-verifiable check: client cannot claim a display time exceeding
// the wall-clock elapsed since the delivery token was issued.

export function assertDurationBounds(
  durationMs: number,
  result: ImpressionResult,
  issuedAt: number
): void {
  const elapsedMs = Date.now() - issuedAt * 1000

  // ceiling: claimed duration cannot exceed elapsed time + clock tolerance
  if (durationMs > elapsedMs + IMPRESSION_CLOCK_TOLERANCE_MS) {
    throw new ValidationError("invalid_duration_ms")
  }

  // floor: completed impressions must meet minimum display threshold
  if (result === "completed" && durationMs < MIN_COMPLETED_DURATION_MS) {
    throw new ValidationError("invalid_duration_ms")
  }
}

// ── POST /impressions ──────────────────────────────────────────────────────

impressionsRouter.post("/", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const input = validateRecordImpression(req.body)
    const delivery = await consumeDeliveryToken(input.deliveryToken, userId)

    assertDurationBounds(input.durationMs, input.result, delivery.issuedAt)

    const impression = await impressionService.recordImpression({
      creativeId: delivery.creativeId,
      deviceId: delivery.deviceId,
      userId: delivery.userId,
      surface: delivery.surface,
      durationMs: input.durationMs,
      result: input.result,
    })

    await res.status(201).json({ impression })
  } catch (err) {
    next(err)
  }
})
