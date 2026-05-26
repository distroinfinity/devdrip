import { Router } from "express"
import { poolSnapshot } from "../services/onchain-snapshot.service.js"

export const onchainPublicRouter: ReturnType<typeof Router> = Router()

onchainPublicRouter.get("/pools/:poolId", async (req, res, next) => {
  try {
    const snap = await poolSnapshot(req.params["poolId"] as string)
    if (!snap) {
      res.status(404).json({ error: "pool_not_found" })
      return
    }
    res.json(snap)
  } catch (err) {
    next(err)
  }
})
