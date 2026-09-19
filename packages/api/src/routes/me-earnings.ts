import { Router } from "express"
import { clampLimit, getRecent, getSummary, getTimeseries } from "../services/earnings.service.js"

export const meEarningsRouter: ReturnType<typeof Router> = Router()

// GET /me/earnings/overview?range=&limit= — everything the revenue page shows, in one
// request. the page refreshes every few seconds, so three calls per refresh added up.
meEarningsRouter.get("/overview", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const [summary, series, recent] = await Promise.all([
      getSummary(userId),
      getTimeseries(userId, req.query["range"]),
      getRecent(userId, clampLimit(req.query["limit"])),
    ])
    res.json({ summary, range: series.range, points: series.points, recent })
  } catch (err) {
    next(err)
  }
})

meEarningsRouter.get("/summary", async (_req, res, next) => {
  try {
    res.json(await getSummary(res.locals["userId"] as string))
  } catch (err) {
    next(err)
  }
})

// ?range=1h (per minute) | 24h (per hour) | 30d (per day, default)
meEarningsRouter.get("/timeseries", async (req, res, next) => {
  try {
    res.json(await getTimeseries(res.locals["userId"] as string, req.query["range"]))
  } catch (err) {
    next(err)
  }
})

meEarningsRouter.get("/recent", async (req, res, next) => {
  try {
    const limit = clampLimit(req.query["limit"])
    res.json({ items: await getRecent(res.locals["userId"] as string, limit) })
  } catch (err) {
    next(err)
  }
})
