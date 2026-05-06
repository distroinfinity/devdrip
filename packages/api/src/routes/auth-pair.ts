import { Router } from "express"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { requireAuth } from "../middleware/auth.js"
import { signAccessToken, SESSION_TTL_SECONDS } from "../lib/jwt.js"
import { env } from "../config/env.js"
import { getDb } from "../db/index.js"
import { devices } from "../db/schema/devices.js"
import {
  createPairingCode,
  exchangePairingCode,
  PAIR_TTL_SECONDS,
} from "../services/pairing.service.js"

export const devicesPairRouter: ReturnType<typeof Router> = Router()

devicesPairRouter.post("/", requireAuth, async (_req, res) => {
  const userId = res.locals["userId"] as string
  const deviceId = res.locals["deviceId"] as string | undefined
  if (!deviceId) {
    await res.status(400).json({ error: "device_required" })
    return
  }
  const code = await createPairingCode({ deviceId, userId })
  const setupUrl = `${env.magicLinkBaseUrl}/setup?pair=${code}`
  await res.status(200).json({ pairingCode: code, ttlSeconds: PAIR_TTL_SECONDS, setupUrl })
})

export const authExchangePairRouter: ReturnType<typeof Router> = Router()

const exchangeSchema = z.object({
  pairingCode: z.string().min(8).max(128),
})

authExchangePairRouter.post("/", async (req, res) => {
  const parse = exchangeSchema.safeParse(req.body)
  if (!parse.success) {
    await res.status(400).json({ error: "invalid_body" })
    return
  }
  const exchange = await exchangePairingCode(parse.data.pairingCode)
  if (!exchange) {
    await res.status(404).json({ error: "pair_code_unknown_or_expired" })
    return
  }

  const [device] = await getDb()
    .select({ id: devices.id, userId: devices.userId })
    .from(devices)
    .where(eq(devices.id, exchange.deviceId))
    .limit(1)
  if (!device) {
    await res.status(404).json({ error: "device_not_found" })
    return
  }

  const accessToken = await signAccessToken(
    { sub: device.userId, deviceId: device.id },
    env.jwtSecret,
    SESSION_TTL_SECONDS
  )

  await res.status(200).json({
    userId: device.userId,
    deviceId: device.id,
    accessToken,
  })
})
