import { Router } from "express"
import {
  getEarningsSummary,
  getEarningsTimeseries,
  TIMESERIES_DEFAULT_DAYS,
  TIMESERIES_MAX_DAYS,
  TIMESERIES_MIN_DAYS,
} from "../services/earnings.service.js"

export const meEarningsRouter: ReturnType<typeof Router> = Router()

meEarningsRouter.get("/summary", async (_req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const summary = await getEarningsSummary(userId)
    res.json(summary)
  } catch (err) {
    next(err)
  }
})

meEarningsRouter.get("/timeseries", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const days = parseDays(req.query["days"])
    if (days === null) {
      return res.status(400).json({
        error: "invalid_days",
        message: `days must be an integer in [${TIMESERIES_MIN_DAYS}, ${TIMESERIES_MAX_DAYS}]`,
      })
    }
    const series = await getEarningsTimeseries(userId, { days })
    res.json(series)
  } catch (err) {
    next(err)
  }
})

function parseDays(raw: unknown): number | null {
  if (raw === undefined || raw === "") return TIMESERIES_DEFAULT_DAYS
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return null
  const n = Number(raw)
  if (n < TIMESERIES_MIN_DAYS || n > TIMESERIES_MAX_DAYS) return null
  return n
}
