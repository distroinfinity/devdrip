import { ValidationError } from "../errors/index.js"
import { requireBody } from "./common.js"

export interface IngestItem {
  deliveryToken: string
}

export interface IngestInput {
  impressions: IngestItem[]
  clicks: IngestItem[]
}

const MAX_ITEMS = 500

export function validateIngest(body: unknown): IngestInput {
  const b = requireBody(body)
  const impressions = parseArray(b["impressions"], "impressions")
  const clicks = parseArray(b["clicks"], "clicks")
  if (impressions.length + clicks.length === 0) {
    throw new ValidationError("empty_ingest")
  }
  if (impressions.length + clicks.length > MAX_ITEMS) {
    throw new ValidationError("too_many_items")
  }
  return { impressions, clicks }
}

function parseArray(raw: unknown, field: string): IngestItem[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) throw new ValidationError(`invalid_${field}`)
  return raw.map((item, i) => {
    if (!item || typeof item !== "object") throw new ValidationError(`invalid_${field}[${i}]`)
    const token = (item as Record<string, unknown>)["deliveryToken"]
    if (typeof token !== "string" || token.trim().length === 0) {
      throw new ValidationError(`missing_delivery_token[${field}:${i}]`)
    }
    return { deliveryToken: token.trim() }
  })
}
