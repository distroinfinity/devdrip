import { Router } from "express"
import { eq } from "drizzle-orm"
import { AdSurface, MAX_ADS_PER_HOUR_TOTAL, MAX_ADS_PER_DAY } from "@devdrip/shared"
import type { AdCategory, IdeType } from "@devdrip/shared"
import { getDb } from "../db/index.js"
import { devices } from "../db/schema/devices.js"
import { preferences } from "../db/schema/preferences.js"
import { validateFetchAds } from "../validators/ad.validators.js"
import { fetchServedAds } from "../services/ad-delivery.service.js"
import { ForbiddenError } from "../errors/index.js"

export const adsRouter: ReturnType<typeof Router> = Router()

// default preferences for users without a preferences row
const DEFAULT_SURFACES = Object.values(AdSurface) as AdSurface[]

// ── POST /ads/next ─────────────────────────────────────────────────────────

adsRouter.post("/next", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const input = validateFetchAds(req.body)

    const db = getDb()

    // fetch device + preferences in parallel
    const [deviceRows, prefRows] = await Promise.all([
      db.select().from(devices).where(eq(devices.id, input.deviceId)),
      db.select().from(preferences).where(eq(preferences.userId, userId)),
    ])

    const device = deviceRows[0]
    if (!device) {
      await res.status(404).json({ error: "device_not_found" })
      return
    }

    // ownership check — device must belong to the requesting user
    if (device.userId !== userId) {
      throw new ForbiddenError("device_not_owned")
    }

    const pref = prefRows[0]

    const ads = await fetchServedAds({
      deviceId: input.deviceId,
      userId,
      os: device.os,
      ideType: device.ideType as IdeType,
      surface: input.surface,
      count: input.count,
      blockedCategories: (pref?.blockedCategories ?? []) as AdCategory[],
      enabledSurfaces: (pref?.enabledSurfaces ?? DEFAULT_SURFACES) as AdSurface[],
      maxAdsPerHour: Math.min(pref?.maxPerHour ?? MAX_ADS_PER_HOUR_TOTAL, MAX_ADS_PER_HOUR_TOTAL),
      maxAdsPerDay: Math.min(pref?.maxPerDay ?? MAX_ADS_PER_DAY, MAX_ADS_PER_DAY),
      quietHoursStart: pref?.quietHoursStart ?? undefined,
      quietHoursEnd: pref?.quietHoursEnd ?? undefined,
      tzOffsetMinutes: pref?.tzOffsetMinutes ?? 0,
      isCI: input.isCI,
    })

    await res.json({ ads })
  } catch (err) {
    next(err)
  }
})
