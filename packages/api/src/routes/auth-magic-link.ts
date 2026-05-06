import { Router } from "express"
import { z } from "zod"
import { MagicLinkError, sendMagicLink, verifyMagicLink } from "../services/magic-link.service.js"
import { logger } from "../lib/logger.js"

export const authMagicLinkRouter: ReturnType<typeof Router> = Router()

const sendBodySchema = z.object({
  email: z.string().min(3).max(254),
  pairingCode: z.string().min(8).max(128).optional(),
})

const verifyBodySchema = z.object({
  token: z.string().min(32).max(128),
})

authMagicLinkRouter.post("/send", async (req, res) => {
  const parse = sendBodySchema.safeParse(req.body)
  if (!parse.success) {
    await res.status(400).json({ error: "invalid_body", detail: parse.error.message })
    return
  }
  try {
    await sendMagicLink(parse.data)
    await res.status(200).json({ ok: true })
  } catch (err) {
    if (err instanceof MagicLinkError) {
      await res.status(err.httpStatus).json({ error: err.code })
      return
    }
    logger.error({ err }, "/auth/magic-link/send failed")
    await res.status(500).json({ error: "internal_error" })
  }
})

authMagicLinkRouter.post("/verify", async (req, res) => {
  const parse = verifyBodySchema.safeParse(req.body)
  if (!parse.success) {
    await res.status(400).json({ error: "invalid_body" })
    return
  }
  try {
    const result = await verifyMagicLink(parse.data.token)
    await res.status(200).json({
      userId: result.userId,
      accessToken: result.accessToken,
      email: result.email,
    })
  } catch (err) {
    if (err instanceof MagicLinkError) {
      await res.status(err.httpStatus).json({ error: err.code })
      return
    }
    logger.error({ err }, "/auth/magic-link/verify failed")
    await res.status(500).json({ error: "internal_error" })
  }
})
