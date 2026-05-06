import { AdSurface } from "@distrotv/shared"
import { ValidationError } from "../errors/index.js"
import { validateUUID, validateEnumValue, requireBody } from "./common.js"

const AD_SURFACES = Object.values(AdSurface) as string[]

// ── types ───────────────────────────────────────────────────────────────────

export interface FetchAdsInput {
  deviceId: string
  surface: AdSurface
  count: number
}

// ── fetch ads (POST body) ───────────────────────────────────────────────────

export function validateFetchAds(body: unknown): FetchAdsInput {
  const b = requireBody(body)

  const deviceId = validateUUID(b["deviceId"], "device_id")
  const surface = validateEnumValue(b["surface"], AD_SURFACES, "surface") as AdSurface

  let count = 1
  if (b["count"] !== undefined) {
    if (typeof b["count"] !== "number" || !Number.isInteger(b["count"]) || b["count"] < 1) {
      throw new ValidationError("invalid_count")
    }
    count = Math.min(b["count"], 10)
  }

  return { deviceId, surface, count }
}

// ── fetch ads (GET query params) ────────────────────────────────────────────

function parseQueryCount(raw: unknown, max: number, defaultVal: number): number {
  if (raw === undefined || raw === null) return defaultVal
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) throw new ValidationError("invalid_count")
  return Math.min(n, max)
}

export function validateFetchAdsNextQuery(query: Record<string, unknown>): FetchAdsInput {
  const deviceId = validateUUID(query["deviceId"], "device_id")
  const surface = validateEnumValue(query["surface"], AD_SURFACES, "surface") as AdSurface
  return { deviceId, surface, count: 1 }
}

export function validateFetchAdsBatchQuery(query: Record<string, unknown>): FetchAdsInput {
  const deviceId = validateUUID(query["deviceId"], "device_id")
  const surface = validateEnumValue(query["surface"], AD_SURFACES, "surface") as AdSurface
  const count = parseQueryCount(query["count"], 10, 5)
  return { deviceId, surface, count }
}
