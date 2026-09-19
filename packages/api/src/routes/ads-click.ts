import { Router } from "express"
import { env } from "../config/env.js"
import { logger } from "../lib/logger.js"
import { recordAdClick } from "../services/ad-impression.service.js"

export const adsClickRouter: ReturnType<typeof Router> = Router()

// GET /ads/click/:deliveryId — public. the redirect target comes only from the
// server-side delivery row, never from the request.
adsClickRouter.get("/click/:deliveryId", async (req, res) => {
  let target: string | null = null
  try {
    target = await recordAdClick(String(req.params["deliveryId"] ?? ""))
  } catch (err) {
    logger.warn({ err }, "ad click record failed")
  }
  res.setHeader("Cache-Control", "no-store")
  res.redirect(302, target ?? env.webUrl)
})

// bare /ads/click (no id, e.g. a half-copied link) → home instead of a raw 404
adsClickRouter.get("/click", (_req, res) => {
  res.redirect(302, env.webUrl)
})
