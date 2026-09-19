import { Router } from "express"
import { getAlertEvents } from "../services/alerts-events.service.js"

export const meAlertsEventsRouter: ReturnType<typeof Router> = Router()

meAlertsEventsRouter.get("/", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const rawLimit = Number(req.query["limit"] ?? 25)
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 25
    const events = await getAlertEvents(userId, limit)
    res.json({ events })
  } catch (err) {
    next(err)
  }
})
