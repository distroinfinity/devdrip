import { Router } from "express"
import { getRedis } from "../lib/redis.js"
import { pendingAlertsKey } from "../lib/onchain-keys.js"

export const testOnchainRouter: ReturnType<typeof Router> = Router()

testOnchainRouter.post("/fire-onchain", async (req, res) => {
  if (process.env["NODE_ENV"] === "production") {
    res.status(404).end()
    return
  }
  const { deviceId, positionId, message } = req.body as {
    deviceId?: unknown
    positionId?: unknown
    message?: unknown
  }
  if (typeof deviceId !== "string" || typeof positionId !== "string") {
    res.status(400).json({ error: "deviceId and positionId required" })
    return
  }
  const alert = {
    positionId,
    type: "range_breach" as const,
    message: typeof message === "string" ? message : "demo breach",
    firedAt: new Date().toISOString(),
  }
  await getRedis().lpush(pendingAlertsKey(deviceId), alert)
  await getRedis().expire(pendingAlertsKey(deviceId), 3600)
  res.json({ ok: true })
})
