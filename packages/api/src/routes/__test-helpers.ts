import { Router } from "express"
import { eq } from "drizzle-orm"
import type { PendingAlert } from "@distrotv/shared"
import { env } from "../config/env.js"
import { getDb } from "../db/index.js"
import { devices } from "../db/schema/devices.js"
import { alertEvents } from "../db/schema/alert_events.js"
import { getRedis } from "../lib/redis.js"
import { pendingAlertsKey } from "../lib/alert-keys.js"

export const testHelpersRouter: ReturnType<typeof Router> = Router()

testHelpersRouter.post("/setup-paired-link", async (_req, res) => {
  if (env.nodeEnv === "production") {
    res.status(404).json({ error: "not_found" })
    return
  }
  res.status(503).json({ error: "test_helper_unavailable_until_m2" })
})

// POST /__test/fire-alert  body: { userId, symbol, changePct, thresholdPct? }
// Inserts alert_events rows + LPUSHes pending alerts for every device the user has.
// Mirrors what the production evaluator does for one specific (user, symbol) pair.
testHelpersRouter.post("/fire-alert", async (req, res, next) => {
  if (env.nodeEnv === "production") {
    res.status(404).json({ error: "not_found" })
    return
  }
  try {
    const { userId, symbol, changePct, thresholdPct } = req.body as {
      userId?: unknown
      symbol?: unknown
      changePct?: unknown
      thresholdPct?: unknown
    }
    if (typeof userId !== "string" || typeof symbol !== "string" || typeof changePct !== "number") {
      res.status(400).json({ error: "invalid_body" })
      return
    }
    const symUpper = symbol.toUpperCase()
    const threshold = typeof thresholdPct === "number" ? thresholdPct : 5

    const db = getDb()
    const userDevices = await db
      .select({ id: devices.id })
      .from(devices)
      .where(eq(devices.userId, userId))
    if (userDevices.length === 0) {
      res.status(404).json({ error: "no_devices_for_user" })
      return
    }

    const firedAt = new Date()
    const redis = getRedis()
    for (const d of userDevices) {
      const pending: PendingAlert = {
        symbol: symUpper,
        changePct,
        thresholdPct: threshold,
        firedAt: firedAt.toISOString(),
      }
      await redis.lpush(pendingAlertsKey(d.id), pending)
      await redis.expire(pendingAlertsKey(d.id), 60 * 60)
      await db.insert(alertEvents).values({
        userId,
        deviceId: d.id,
        symbol: symUpper,
        changePct,
        thresholdPct: threshold,
        firedAt,
      })
    }

    res.json({ ok: true, fanned: userDevices.length })
  } catch (err) {
    next(err)
  }
})
