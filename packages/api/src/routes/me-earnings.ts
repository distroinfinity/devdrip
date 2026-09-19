import { Router } from "express"
import { getEarningsSummary } from "../services/earnings.service.js"

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
