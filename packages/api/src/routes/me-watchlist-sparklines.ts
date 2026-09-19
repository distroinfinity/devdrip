import { Router } from "express"
import { getSparklines } from "../services/sparklines.service.js"

export const meWatchlistSparklinesRouter: ReturnType<typeof Router> = Router()

const MAX_WINDOW_SEC = 7 * 86400
const DEFAULT_WINDOW_SEC = 86400

meWatchlistSparklinesRouter.get("/", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const raw = Number(req.query["windowSec"] ?? DEFAULT_WINDOW_SEC)
    const windowSec = Math.min(isNaN(raw) ? DEFAULT_WINDOW_SEC : Math.max(raw, 1), MAX_WINDOW_SEC)
    const sparklines = await getSparklines(userId, windowSec)
    res.json({ sparklines })
  } catch (err) {
    next(err)
  }
})
