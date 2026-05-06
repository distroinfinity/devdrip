import { ImpressionResult, NewsSource } from "@distrotv/shared"
import { ValidationError } from "../errors/index.js"
import { requireBody } from "./common.js"

export interface IngestItem {
  deliveryToken: string
}

export interface NewsImpressionItem {
  newsId: string
  source: NewsSource
  deviceId: string
  durationMs: number
  result: ImpressionResult
  openedUrl: boolean
  saved: boolean
}

export interface IngestInput {
  impressions: IngestItem[]
  clicks: IngestItem[]
  newsImpressions: NewsImpressionItem[]
}

const MAX_ITEMS = 500
const NEWS_SOURCES = Object.values(NewsSource) as string[]
const IMPRESSION_RESULTS = Object.values(ImpressionResult) as string[]
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validateIngest(body: unknown): IngestInput {
  const b = requireBody(body)
  const impressions = parseTokenArray(b["impressions"], "impressions")
  const clicks = parseTokenArray(b["clicks"], "clicks")
  const newsImpressions = parseNewsArray(b["newsImpressions"], "newsImpressions")
  const total = impressions.length + clicks.length + newsImpressions.length
  if (total === 0) {
    throw new ValidationError("empty_ingest")
  }
  if (total > MAX_ITEMS) {
    throw new ValidationError("too_many_items")
  }
  return { impressions, clicks, newsImpressions }
}

function parseTokenArray(raw: unknown, field: string): IngestItem[] {
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

function parseNewsArray(raw: unknown, field: string): NewsImpressionItem[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) throw new ValidationError(`invalid_${field}`)
  return raw.map((item, i) => {
    if (!item || typeof item !== "object") throw new ValidationError(`invalid_${field}[${i}]`)
    const o = item as Record<string, unknown>

    const newsId = o["newsId"]
    if (typeof newsId !== "string" || newsId.length === 0 || newsId.length > 64) {
      throw new ValidationError(`invalid_${field}[${i}].newsId`)
    }
    const source = o["source"]
    if (typeof source !== "string" || !NEWS_SOURCES.includes(source)) {
      throw new ValidationError(`invalid_${field}[${i}].source`)
    }
    const deviceId = o["deviceId"]
    if (typeof deviceId !== "string" || !UUID_RE.test(deviceId)) {
      throw new ValidationError(`invalid_${field}[${i}].deviceId`)
    }
    const durationMs = o["durationMs"]
    if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0) {
      throw new ValidationError(`invalid_${field}[${i}].durationMs`)
    }
    const result = o["result"]
    if (typeof result !== "string" || !IMPRESSION_RESULTS.includes(result)) {
      throw new ValidationError(`invalid_${field}[${i}].result`)
    }
    // openedUrl + saved default to false if missing
    const openedUrl = o["openedUrl"] === true
    const saved = o["saved"] === true

    return {
      newsId,
      source: source as NewsSource,
      deviceId,
      durationMs: Math.floor(durationMs),
      result: result as ImpressionResult,
      openedUrl,
      saved,
    }
  })
}
