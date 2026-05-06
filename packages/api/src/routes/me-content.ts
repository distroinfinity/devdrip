import { Router } from "express"
import { AdSurface, ChannelMode } from "@distrotv/shared"
import { fetchSlots, type ContentRequest } from "../services/content-delivery.service.js"
import { ValidationError } from "../errors/index.js"
import { logger } from "../lib/logger.js"
import { buildBaseRequest } from "../lib/request-builder.js"

export const meContentRouter: ReturnType<typeof Router> = Router()

const DEFAULT_N = 10
const MAX_N = 25
const ALL_SURFACES = Object.values(AdSurface) as AdSurface[]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidChannelMode(value: unknown): value is ChannelMode {
  return value === "earn" || value === "learn" || value === "mix"
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
    let surface: AdSurface = AdSurface.TerminalTv
    if (typeof surfaceRaw === "string") {
      if (!ALL_SURFACES.includes(surfaceRaw as AdSurface)) {
        throw new ValidationError("invalid_surface")
      }
      surface = surfaceRaw as AdSurface
    }

    const { request: base, pref } = await buildBaseRequest(userId, deviceId, surface, n)
    const channelMode = isValidChannelMode(pref?.channelMode)
      ? (pref.channelMode as ChannelMode)
      : ChannelMode.Mix
    const request: ContentRequest = { ...base, channelMode }

    const items = await fetchSlots(request, n)

    res.set("Cache-Control", "private, no-store")
    logger.debug(
      { userId, channelMode: request.channelMode, requested: n, served: items.length },
      "content.next"
    )
    res.json({ items })
  } catch (err) {
    next(err)
  }
})
