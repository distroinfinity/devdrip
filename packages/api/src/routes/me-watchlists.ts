import { Router } from "express"
import { getWatchlistsForUser, setWatchlist } from "../services/watchlist.service.js"
import { validatePutWatchlistsInput } from "../validators/watchlists.validators.js"

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
    const input = validatePutWatchlistsInput(req.body)
    await setWatchlist(userId, input.tickers)
    const items = await getWatchlistsForUser(userId)
    res.json({ watchlists: items })
  } catch (err) {
    next(err)
  }
})
