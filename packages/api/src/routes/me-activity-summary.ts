import { Router } from "express"
import { getActivitySummary } from "../services/activity-summary.service.js"

export const meActivitySummaryRouter: ReturnType<typeof Router> = Router()

const MAX_WINDOW_SEC = 7 * 86400
const DEFAULT_WINDOW_SEC = 86400

meActivitySummaryRouter.get("/", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const raw = Number(req.query["windowSec"] ?? DEFAULT_WINDOW_SEC)
    const windowSec = Math.min(isNaN(raw) ? DEFAULT_WINDOW_SEC : Math.max(raw, 1), MAX_WINDOW_SEC)
    const dto = await getActivitySummary(userId, windowSec)
    res.json(dto)
  } catch (err) {
    next(err)
  }
})
