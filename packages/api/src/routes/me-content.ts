import { Router } from "express"
import type { NewsPayload } from "@distrotv/shared"
import { nextPicksForDevice } from "../services/news-selection.service.js"

export const meContentRouter: ReturnType<typeof Router> = Router()

// GET /me/content/next?n=N&deviceId=...&surface=terminal-tv
// returns { items: NewsPayload[] } from multi-channel selection.
// M4 will branch this on `surface` to mix in ticker payloads.
meContentRouter.get("/next", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const deviceId =
      (req.query["deviceId"] as string | undefined) ??
      (res.locals["deviceId"] as string | undefined)
    if (!deviceId) {
      res.status(400).json({ error: "device_id_required" })
      return
    }
    const n = Number.parseInt((req.query["n"] as string | undefined) ?? "5", 10)
    void (req.query["surface"] as string | undefined) // M4: gate ticker vs news

    const items: NewsPayload[] = await nextPicksForDevice({
      userId,
      deviceId,
      n: Math.min(Number.isFinite(n) ? n : 5, 20),
    })
    res.json({ items })
  } catch (err) {
    next(err)
  }
})
