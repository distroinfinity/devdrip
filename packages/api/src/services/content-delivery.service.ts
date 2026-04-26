import type {
  AdRequest,
  AdPayload,
  ServedAdPayload,
  NewsPayload,
  SlotContent,
} from "@devdrip/shared"
import { ChannelMode } from "@devdrip/shared"
import { manualAdProvider } from "./ad-selection.service.js"
import { carbonAdProvider } from "./carbon-ad.provider.js"
import { issueDeliveryToken } from "../lib/ad-delivery.js"
import { checkFrequencyCaps, isQuietHours } from "../lib/frequency.js"
import { logger } from "../lib/logger.js"
import { pickNewsForUser } from "./news.service.js"
import { getRedis } from "../lib/redis.js"

// ── waterfall ──────────────────────────────────────────────────────────────
// order: Carbon (primary) → Manual (fallback).
// frequency caps and quiet hours are checked here once, so individual
// providers don't need to duplicate them.

async function fetchFromWaterfall(request: AdRequest): Promise<AdPayload[]> {
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

// ── content slots ──────────────────────────────────────────────────────────
// ContentRequest extends AdRequest with channelMode. fetchServedAds keeps
// taking AdRequest unchanged; only fetchSlots needs the channel.

export interface ContentRequest extends AdRequest {
  channelMode: ChannelMode
}

const MIX_COUNTER_TTL_SEC = 90 * 86400

export async function fetchSlots(request: ContentRequest, count: number): Promise<SlotContent[]> {
  if (request.channelMode === ChannelMode.Earn) return fetchAdSlots(request, count)
  if (request.channelMode === ChannelMode.Learn) return fetchNewsSlots(request, count)
  return fetchMixSlots(request, count)
}

async function fetchAdSlots(req: ContentRequest, n: number): Promise<SlotContent[]> {
  const ads = await fetchServedAds({ ...req, count: n })
  return ads.map((payload) => ({ kind: "ad", payload }))
}

async function fetchNewsSlots(req: ContentRequest, n: number): Promise<SlotContent[]> {
  const items = await Promise.all(Array.from({ length: n }, () => pickNewsForUser(req.userId)))
  return items
    .filter((p): p is NewsPayload => p !== null)
    .map((payload) => ({ kind: "news", payload }))
}

async function fetchMixSlots(req: ContentRequest, n: number): Promise<SlotContent[]> {
  // allocate n consecutive positions atomically. counter advances on allocation,
  // not fulfillment — partial-fill drift is documented and acceptable for mvp.
  const redis = getRedis()
  const counterKey = `mix:counter:${req.userId}`
  const after = await redis.incrby(counterKey, n)
  // ttl slides on every mix call: an inactive user's counter expires 90 days
  // after their LAST mix request, not 90 days after creation. by design.
  await redis.expire(counterKey, MIX_COUNTER_TTL_SEC)
  const start = after - n

  const wantsAd = (pos: number) => pos % 2 === 0
  let needAd = 0
  let needNews = 0
  for (let i = 0; i < n; i++) {
    if (wantsAd(start + i)) needAd++
    else needNews++
  }

  const [ads, news] = await Promise.all([
    needAd > 0 ? fetchServedAds({ ...req, count: needAd }) : Promise.resolve([]),
    needNews > 0
      ? Promise.all(Array.from({ length: needNews }, () => pickNewsForUser(req.userId)))
      : Promise.resolve([] as Array<NewsPayload | null>),
  ])

  const slots: SlotContent[] = []
  let ai = 0
  let ni = 0
  for (let i = 0; i < n; i++) {
    if (wantsAd(start + i)) {
      const ad = ads[ai++]
      if (ad) slots.push({ kind: "ad", payload: ad })
    } else {
      const item = news[ni++]
      if (item) slots.push({ kind: "news", payload: item })
    }
  }
  return slots
}
