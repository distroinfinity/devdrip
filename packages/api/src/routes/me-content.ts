import { Router } from "express"
import type { NewsPayload } from "@distrotv/shared"
import { fetchNewsForDevice } from "../services/news.service.js"

export const meContentRouter: ReturnType<typeof Router> = Router()

// GET /me/content/next?n=N&deviceId=...&surface=terminal-tv
// returns { items: NewsPayload[] } (M3 extends with channel selection + scoring;
// M4 adds ticker selection. for M1, news-only, top-N de-duped by user).
meContentRouter.get("/next", async (req, res) => {
  const userId = res.locals["userId"] as string
  const deviceId =
    (req.query["deviceId"] as string | undefined) ?? (res.locals["deviceId"] as string | undefined)
  const n = Number.parseInt((req.query["n"] as string | undefined) ?? "5", 10)
  void (req.query["surface"] as string | undefined) // M4: gate ticker vs news

  const items: NewsPayload[] = await fetchNewsForDevice({
    userId,
    deviceId,
    limit: Math.min(n, 20),
  })
  res.json({ items })
})
