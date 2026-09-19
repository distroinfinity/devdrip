import { Router } from "express"
import { parseAnalyticsQuery } from "../validators/analytics.validators.js"
import { getUserImpressionAnalytics } from "../services/analytics.service.js"

export const meAnalyticsRouter: ReturnType<typeof Router> = Router()

meAnalyticsRouter.get("/impressions", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const filters = parseAnalyticsQuery(req.query as Record<string, unknown>)
    const data = await getUserImpressionAnalytics(userId, filters)
    res.json(data)
  } catch (err) {
    next(err)
  }
})
