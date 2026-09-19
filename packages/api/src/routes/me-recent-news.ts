import { Router } from "express"
import { getRecentNews } from "../services/recent-news.service.js"

export const meRecentNewsRouter: ReturnType<typeof Router> = Router()

meRecentNewsRouter.get("/", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const raw = Number(req.query["limit"] ?? 25)
    const limit = Math.min(isNaN(raw) ? 25 : Math.max(1, raw), 50)
    const items = await getRecentNews(userId, limit)
    res.json({ items })
  } catch (err) {
    next(err)
  }
})
