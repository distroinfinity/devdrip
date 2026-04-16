import { AdSurface } from "@devdrip/shared"
import { ValidationError } from "../errors/index.js"
import { validateUUID, validateEnumValue, requireBody } from "./common.js"

const AD_SURFACES = Object.values(AdSurface) as string[]

// ── types ───────────────────────────────────────────────────────────────────

export interface FetchAdsInput {
  deviceId: string
  surface: AdSurface
  count: number
  isCI?: boolean
}

export interface RecordImpressionInput {
  deliveryToken: string
}

export interface RecordClickInput {
  impressionId: string
}

// ── fetch ads ───────────────────────────────────────────────────────────────

export function validateFetchAds(body: unknown): FetchAdsInput {
  const b = requireBody(body)

  const deviceId = validateUUID(b["deviceId"], "device_id")
  const surface = validateEnumValue(b["surface"], AD_SURFACES, "surface") as AdSurface

  let count = 1
  if (b["count"] !== undefined) {
    if (typeof b["count"] !== "number" || !Number.isInteger(b["count"]) || b["count"] < 1) {
      throw new ValidationError("invalid_count")
    }
    count = Math.min(b["count"], 5)
  }

  const isCI = b["isCI"] === true ? true : undefined

  return { deviceId, surface, count, isCI }
}

// ── record impression ───────────────────────────────────────────────────────

export function validateRecordImpression(body: unknown): RecordImpressionInput {
  const b = requireBody(body)

  if (typeof b["deliveryToken"] !== "string" || b["deliveryToken"].trim().length === 0) {
    throw new ValidationError("missing_delivery_token")
  }
  const deliveryToken = b["deliveryToken"].trim()
  return { deliveryToken }
}

// ── record click ────────────────────────────────────────────────────────────

export function validateRecordClick(body: unknown): RecordClickInput {
  const b = requireBody(body)
  const impressionId = validateUUID(b["impressionId"], "impression_id")
  return { impressionId }
}
