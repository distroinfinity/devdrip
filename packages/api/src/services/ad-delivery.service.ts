import type { AdRequest, AdPayload, ServedAdPayload } from "@devdrip/shared"
import { manualAdProvider } from "./ad-selection.service.js"
import { carbonAdProvider } from "./carbon-ad.provider.js"
import { issueDeliveryToken } from "../lib/ad-delivery.js"
import { checkFrequencyCaps, isQuietHours } from "../lib/frequency.js"
import { logger } from "../lib/logger.js"

// ── waterfall ──────────────────────────────────────────────────────────────
// order: Carbon (primary) → Manual (fallback).
// frequency caps and quiet hours are checked here once, so individual
// providers don't need to duplicate them.

async function fetchFromWaterfall(request: AdRequest): Promise<AdPayload[]> {
  // CI environments get no ads
  if (request.isCI) {
    logger.debug("CI environment detected, skipping ads")
    return []
  }

  // surface gate
  if (!request.enabledSurfaces.includes(request.surface)) {
    logger.debug({ surface: request.surface }, "surface disabled by user preferences")
    return []
  }

  // quiet hours
  if (isQuietHours(request.quietHoursStart, request.quietHoursEnd, request.tzOffsetMinutes)) {
    logger.debug("quiet hours active, skipping ads")
    return []
  }

  // frequency caps
  const capCheck = await checkFrequencyCaps(
    request.deviceId,
    request.surface,
    request.maxAdsPerHour,
    request.maxAdsPerDay
  )
  if (!capCheck.allowed) {
    logger.debug({ reason: capCheck.reason }, "frequency cap exceeded")
    return []
  }

  // primary: Carbon Ads
  const carbon = await carbonAdProvider.fetchAds(request)
  if (carbon.length >= request.count) return carbon.slice(0, request.count)

  // fallback: manual campaigns
  const remaining = request.count - carbon.length
  const manual = await manualAdProvider.fetchAds({ ...request, count: remaining })

  return [...carbon, ...manual].slice(0, request.count)
}

// ── public API ─────────────────────────────────────────────────────────────

export async function fetchServedAds(request: AdRequest): Promise<ServedAdPayload[]> {
  const ads = await fetchFromWaterfall(request)

  return Promise.all(
    ads.map(async (ad) => ({
      ...ad,
      deliveryToken: await issueDeliveryToken({
        userId: request.userId,
        deviceId: request.deviceId,
        creativeId: ad.id,
        surface: request.surface,
      }),
    }))
  )
}
