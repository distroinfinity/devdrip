import { AdCategory } from "@devdrip/shared"
import { ValidationError } from "../errors/index.js"
import { requireBody, validateEnumArray } from "./common.js"

const AD_CATEGORIES = Object.values(AdCategory) as string[]

export interface UpdatePreferencesInput {
  blockedCategories?: AdCategory[]
  tzOffsetMinutes?: number
}

const ALLOWED_KEYS = new Set(["blockedCategories", "tzOffsetMinutes"])

export function validateUpdatePreferences(body: unknown): UpdatePreferencesInput {
  const b = requireBody(body)

  for (const k of Object.keys(b)) {
    if (!ALLOWED_KEYS.has(k)) throw new ValidationError("unknown_field")
  }

  const out: UpdatePreferencesInput = {}

  if (b["blockedCategories"] !== undefined) {
    const arr = validateEnumArray(b["blockedCategories"], AD_CATEGORIES, "blocked_categories")
    out.blockedCategories = arr as AdCategory[]
  }

  if (b["tzOffsetMinutes"] !== undefined) {
    const v = b["tzOffsetMinutes"]
    if (typeof v !== "number" || !Number.isInteger(v) || v < -720 || v > 840) {
      throw new ValidationError("invalid_tz_offset_minutes")
    }
    out.tzOffsetMinutes = v
  }

  return out
}
