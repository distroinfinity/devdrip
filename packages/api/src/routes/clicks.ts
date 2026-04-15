import { Router } from "express"
import { eq } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { impressions } from "../db/schema/impressions.js"
import { devices } from "../db/schema/devices.js"
import { validateRecordClick } from "../validators/ad.validators.js"
import * as impressionService from "../services/impression.service.js"
import { ForbiddenError, NotFoundError } from "../errors/index.js"

export const clicksRouter: ReturnType<typeof Router> = Router()

// ── POST /clicks ───────────────────────────────────────────────────────────

clicksRouter.post("/", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const { impressionId } = validateRecordClick(req.body)

    // verify ownership chain: impression → device → user
    const db = getDb()
    const [imp] = await db
      .select({ deviceId: impressions.deviceId })
      .from(impressions)
      .where(eq(impressions.id, impressionId))
    if (!imp) throw new NotFoundError("impression")

    const [device] = await db
      .select({ userId: devices.userId })
      .from(devices)
      .where(eq(devices.id, imp.deviceId))
    if (!device) throw new NotFoundError("device")
    if (device.userId !== userId) throw new ForbiddenError("device_not_owned")

    const result = await impressionService.recordClick(impressionId)
    await res.status(201).json(result)
  } catch (err) {
    next(err)
  }
})
