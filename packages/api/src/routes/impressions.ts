import { Router } from "express"
import { validateRecordImpression } from "../validators/ad.validators.js"
import * as impressionService from "../services/impression.service.js"
import { consumeDeliveryToken } from "../lib/ad-delivery.js"

export const impressionsRouter: ReturnType<typeof Router> = Router()

// ── POST /impressions ──────────────────────────────────────────────────────

impressionsRouter.post("/", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const input = validateRecordImpression(req.body)
    const delivery = await consumeDeliveryToken(input.deliveryToken, userId)

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
