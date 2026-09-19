import { Router } from "express"
import {
  clampDays,
  clampLimit,
  getRecent,
  getSummary,
  getTimeseries,
} from "../services/earnings.service.js"

export const meEarningsRouter: ReturnType<typeof Router> = Router()

meEarningsRouter.get("/summary", async (_req, res, next) => {
  try {
    res.json(await getSummary(res.locals["userId"] as string))
  } catch (err) {
    next(err)
  }
})

meEarningsRouter.get("/timeseries", async (req, res, next) => {
  try {
    const days = clampDays(req.query["days"])
    res.json({ points: await getTimeseries(res.locals["userId"] as string, days) })
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
