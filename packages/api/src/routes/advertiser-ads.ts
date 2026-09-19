import { Router } from "express"
import { createAd, listMyAds, parseNewAd, setAdStatus } from "../services/advertiser-ads.service.js"

export const advertiserAdsRouter: ReturnType<typeof Router> = Router()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /advertiser/ads — the signed-in user's ads with delivery stats
advertiserAdsRouter.get("/ads", async (_req, res, next) => {
  try {
    res.json({ ads: await listMyAds(res.locals["userId"] as string) })
  } catch (err) {
    next(err)
  }
})

// POST /advertiser/ads { brand, line, url, bidCpm? }
advertiserAdsRouter.post("/ads", async (req, res, next) => {
  try {
    const parsed = parseNewAd(req.body)
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error })
      return
    }
    const result = await createAd(res.locals["userId"] as string, parsed.ad)
    if ("error" in result) {
      res.status(409).json({ error: result.error })
      return
    }
    res.status(201).json({ ad: result.ad })
  } catch (err) {
    next(err)
  }
})

// PATCH /advertiser/ads/:id { status: "active" | "paused" }
advertiserAdsRouter.patch("/ads/:id", async (req, res, next) => {
  try {
    const id = String(req.params["id"] ?? "")
    const status = (req.body as { status?: unknown } | null)?.status
    if (!UUID_RE.test(id) || (status !== "active" && status !== "paused")) {
      res.status(400).json({ error: "invalid_request" })
      return
    }
    const result = await setAdStatus(res.locals["userId"] as string, id, status)
    if ("error" in result) {
      res.status(result.error === "not_found" ? 404 : 409).json({ error: result.error })
      return
    }
    res.json({ ad: result.ad })
  } catch (err) {
    next(err)
  }
})
