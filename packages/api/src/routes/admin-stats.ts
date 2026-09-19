import { Router } from "express"
import * as adminStatsService from "../services/admin-stats.service.js"

export const adminStatsRouter: ReturnType<typeof Router> = Router()

adminStatsRouter.get("/", async (_req, res, next) => {
  try {
    const stats = await adminStatsService.getStats()
    await res.json(stats)
  } catch (err) {
    next(err)
  }
})
