import { eq } from "drizzle-orm"
import { AdSurface, MAX_ADS_PER_HOUR_TOTAL, MAX_ADS_PER_DAY } from "@distrotv/shared"
import type { AdCategory, AdRequest, IdeType } from "@distrotv/shared"
import { getDb } from "../db/index.js"
import { devices } from "../db/schema/devices.js"
import { preferences } from "../db/schema/preferences.js"
import { ForbiddenError, NotFoundError } from "../errors/index.js"

const DEFAULT_SURFACES = Object.values(AdSurface) as AdSurface[]

// returns AdRequest plus the raw preferences row (callers extend the request
// with their own derived fields — e.g. channelMode for ContentRequest).
export interface BaseRequestResult {
  request: AdRequest
  pref: typeof preferences.$inferSelect | undefined
}

export async function buildBaseRequest(
  userId: string,
  deviceId: string,
  surface: AdSurface,
  count: number
): Promise<BaseRequestResult> {
  const db = getDb()

  const [deviceRows, prefRows] = await Promise.all([
    db.select().from(devices).where(eq(devices.id, deviceId)),
    db.select().from(preferences).where(eq(preferences.userId, userId)),
  ])

  const device = deviceRows[0]
  if (!device) throw new NotFoundError("device")
  if (device.userId !== userId) throw new ForbiddenError("device_not_owned")

  const pref = prefRows[0]

  const request: AdRequest = {
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
  }

  return { request, pref }
}
