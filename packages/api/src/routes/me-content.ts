import { Router } from "express"
import { eq } from "drizzle-orm"
import { AdSurface, ChannelMode, MAX_ADS_PER_HOUR_TOTAL, MAX_ADS_PER_DAY } from "@devdrip/shared"
import type { AdCategory, IdeType, SlotContent } from "@devdrip/shared"
import { getDb } from "../db/index.js"
import { devices } from "../db/schema/devices.js"
import { preferences } from "../db/schema/preferences.js"
import { fetchSlots, type ContentRequest } from "../services/content-delivery.service.js"
import { ForbiddenError, NotFoundError, ValidationError } from "../errors/index.js"
import { logger } from "../lib/logger.js"

export const meContentRouter: ReturnType<typeof Router> = Router()

const DEFAULT_N = 10
const MAX_N = 25
const DEFAULT_SURFACES = Object.values(AdSurface) as AdSurface[]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidChannelMode(value: unknown): value is ChannelMode {
  return value === "earn" || value === "learn" || value === "mix"
}

async function buildContentRequest(
  userId: string,
  deviceId: string,
  surface: AdSurface,
  count: number
): Promise<ContentRequest> {
  const db = getDb()

  const [deviceRows, prefRows] = await Promise.all([
    db.select().from(devices).where(eq(devices.id, deviceId)),
    db.select().from(preferences).where(eq(preferences.userId, userId)),
  ])

  const device = deviceRows[0]
  if (!device) throw new NotFoundError("device")
  if (device.userId !== userId) throw new ForbiddenError("device_not_owned")

  const pref = prefRows[0]
  // default to mix if no row exists yet (matches shared defaults)
  const channelMode = isValidChannelMode(pref?.channelMode)
    ? (pref.channelMode as ChannelMode)
    : ChannelMode.Mix

  return {
    deviceId,
    userId,
    os: device.os,
    ideType: device.ideType as IdeType,
    surface,
    count,
    blockedCategories: (pref?.blockedCategories ?? []) as AdCategory[],
    enabledSurfaces: (pref?.enabledSurfaces && pref.enabledSurfaces.length > 0
      ? pref.enabledSurfaces
      : DEFAULT_SURFACES) as AdSurface[],
    maxAdsPerHour: Math.min(pref?.maxPerHour ?? MAX_ADS_PER_HOUR_TOTAL, MAX_ADS_PER_HOUR_TOTAL),
    maxAdsPerDay: Math.min(pref?.maxPerDay ?? MAX_ADS_PER_DAY, MAX_ADS_PER_DAY),
    quietHoursStart: pref?.quietHoursStart ?? undefined,
    quietHoursEnd: pref?.quietHoursEnd ?? undefined,
    tzOffsetMinutes: pref?.tzOffsetMinutes ?? 0,
    channelMode,
  }
}

// camelCase response payload — daemon consumes SlotContent directly
function toResponse(slot: SlotContent) {
  return slot
}

meContentRouter.get("/next", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const deviceIdRaw = req.query["deviceId"]
    if (typeof deviceIdRaw !== "string" || !UUID_RE.test(deviceIdRaw)) {
      throw new ValidationError("invalid_device_id")
    }
    const deviceId = deviceIdRaw

    const nRaw = req.query["n"]
    const nParsed = typeof nRaw === "string" ? Number.parseInt(nRaw, 10) : DEFAULT_N
    const n = Number.isFinite(nParsed) ? Math.max(1, Math.min(MAX_N, nParsed)) : DEFAULT_N

    const surfaceRaw = req.query["surface"]
    const surface =
      typeof surfaceRaw === "string" && DEFAULT_SURFACES.includes(surfaceRaw as AdSurface)
        ? (surfaceRaw as AdSurface)
        : AdSurface.TerminalTv

    const request = await buildContentRequest(userId, deviceId, surface, n)
    const items = await fetchSlots(request, n)

    res.set("Cache-Control", "private, no-store")
    logger.debug(
      { userId, channelMode: request.channelMode, requested: n, served: items.length },
      "content.next"
    )
    res.json({ items: items.map(toResponse) })
  } catch (err) {
    next(err)
  }
})
