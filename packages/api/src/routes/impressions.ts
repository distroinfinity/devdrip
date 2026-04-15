import { Router } from "express"
import { eq } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { devices } from "../db/schema/devices.js"
import { validateRecordImpression } from "../validators/ad.validators.js"
import * as impressionService from "../services/impression.service.js"
import { ForbiddenError, NotFoundError } from "../errors/index.js"

export const impressionsRouter: ReturnType<typeof Router> = Router()

// ── POST /impressions ──────────────────────────────────────────────────────

impressionsRouter.post("/", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const input = validateRecordImpression(req.body)

    // verify device ownership
    const db = getDb()
    const [device] = await db.select().from(devices).where(eq(devices.id, input.deviceId))
    if (!device) throw new NotFoundError("device")
    if (device.userId !== userId) throw new ForbiddenError("device_not_owned")

    const impression = await impressionService.recordImpression({
      ...input,
      userId,
    })

    await res.status(201).json({ impression })
  } catch (err) {
    next(err)
  }
})
