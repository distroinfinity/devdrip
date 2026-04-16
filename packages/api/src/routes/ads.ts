import { Router } from "express"
import { eq } from "drizzle-orm"
import { AdSurface, MAX_ADS_PER_HOUR_TOTAL, MAX_ADS_PER_DAY } from "@devdrip/shared"
import type { AdCategory, AdRequest, IdeType, ServedAdPayload } from "@devdrip/shared"
import { getDb } from "../db/index.js"
import { devices } from "../db/schema/devices.js"
import { preferences } from "../db/schema/preferences.js"
import {
  validateFetchAds,
  validateFetchAdsNextQuery,
  validateFetchAdsBatchQuery,
} from "../validators/ad.validators.js"
import { fetchServedAds } from "../services/ad-delivery.service.js"
import { ForbiddenError, NotFoundError } from "../errors/index.js"

export const adsRouter: ReturnType<typeof Router> = Router()

// default preferences for users without a preferences row
const DEFAULT_SURFACES = Object.values(AdSurface) as AdSurface[]

// ── helpers ───────────────────────────────────────────────────────────────────

async function buildAdRequest(
  userId: string,
  deviceId: string,
  surface: AdSurface,
  count: number
): Promise<AdRequest> {
  const db = getDb()

  const [deviceRows, prefRows] = await Promise.all([
    db.select().from(devices).where(eq(devices.id, deviceId)),
    db.select().from(preferences).where(eq(preferences.userId, userId)),
  ])

  const device = deviceRows[0]
  if (!device) throw new NotFoundError("device")
  if (device.userId !== userId) throw new ForbiddenError("device_not_owned")

  const pref = prefRows[0]

  return {
    deviceId,
    userId,
    os: device.os,
    ideType: device.ideType as IdeType,
    surface,
    count,
    blockedCategories: (pref?.blockedCategories ?? []) as AdCategory[],
    enabledSurfaces: (pref?.enabledSurfaces ?? DEFAULT_SURFACES) as AdSurface[],
    maxAdsPerHour: Math.min(pref?.maxPerHour ?? MAX_ADS_PER_HOUR_TOTAL, MAX_ADS_PER_HOUR_TOTAL),
    maxAdsPerDay: Math.min(pref?.maxPerDay ?? MAX_ADS_PER_DAY, MAX_ADS_PER_DAY),
    quietHoursStart: pref?.quietHoursStart ?? undefined,
    quietHoursEnd: pref?.quietHoursEnd ?? undefined,
    tzOffsetMinutes: pref?.tzOffsetMinutes ?? 0,
  }
}

function toAdResponse(ad: ServedAdPayload) {
  return {
    id: ad.id,
    campaign_id: ad.campaignId,
    format: ad.format,
    headline: ad.headline,
    body: ad.body,
    url: ad.url,
    display_time_ms: ad.displayTimeMs,
    delivery_token: ad.deliveryToken,
    impression_beacon_url: ad.impressionBeaconUrl ?? null,
    click_tracking_url: ad.clickTrackingUrl ?? null,
  }
}

// ── GET /ads/next — single ad, 204 when exhausted ────────────────────────────

adsRouter.get("/next", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const input = validateFetchAdsNextQuery(req.query as Record<string, unknown>)
    const request = await buildAdRequest(userId, input.deviceId, input.surface, 1)
    const ads = await fetchServedAds(request)

    if (ads.length === 0) {
      res.status(204).end()
      return
    }

    const first = ads[0]
    if (first) await res.json({ ad: toAdResponse(first) })
  } catch (err) {
    next(err)
  }
})

// ── GET /ads/batch — up to 10 ads, 204 when exhausted ────────────────────────

adsRouter.get("/batch", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const input = validateFetchAdsBatchQuery(req.query as Record<string, unknown>)
    const request = await buildAdRequest(userId, input.deviceId, input.surface, input.count)
    const ads = await fetchServedAds(request)

    if (ads.length === 0) {
      res.status(204).end()
      return
    }

    await res.json({ ads: ads.map(toAdResponse) })
  } catch (err) {
    next(err)
  }
})

// ── POST /ads/next — backward-compatible, supports count up to 10 ─────────

adsRouter.post("/next", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const input = validateFetchAds(req.body)
    const request = await buildAdRequest(userId, input.deviceId, input.surface, input.count)
    const ads = await fetchServedAds(request)

    if (ads.length === 0) {
      res.status(204).end()
      return
    }

    await res.json({ ads: ads.map(toAdResponse) })
  } catch (err) {
    next(err)
  }
})
