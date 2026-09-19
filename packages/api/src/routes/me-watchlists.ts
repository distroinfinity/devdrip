import { Router } from "express"
import { getWatchlistsForUser, setWatchlists } from "../services/watchlist.service.js"
import { validatePutWatchlists } from "../validators/watchlists.validators.js"

export const meWatchlistsRouter: ReturnType<typeof Router> = Router()

meWatchlistsRouter.get("/", async (_req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const items = await getWatchlistsForUser(userId)
    res.json({ watchlists: items })
  } catch (err) {
    next(err)
  }
})

meWatchlistsRouter.put("/", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const input = validatePutWatchlists(req.body)
    await setWatchlists(userId, input.watchlists)
    const items = await getWatchlistsForUser(userId)
    res.json({ watchlists: items })
  } catch (err) {
    next(err)
  }
})
