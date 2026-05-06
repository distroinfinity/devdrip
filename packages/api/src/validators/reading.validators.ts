import { NewsSource } from "@distrotv/shared"
import { ValidationError } from "../errors/index.js"
import { requireBody, validateEnumValue, validateStringField, validateUrl } from "./common.js"

const NEWS_SOURCES = Object.values(NewsSource) as string[]

export interface SaveReadingItemBody {
  newsId: string
  source: NewsSource
  headline: string
  url: string
  score: number
}

export function validateSaveReadingItem(body: unknown): SaveReadingItemBody {
  const b = requireBody(body)

  const newsId = validateStringField(b["newsId"], "news_id", { required: true, maxLength: 64 })
  const source = validateEnumValue(b["source"], NEWS_SOURCES, "source") as NewsSource
  const headline = validateStringField(b["headline"], "headline", {
    required: true,
    maxLength: 512,
  })
  const url = validateUrl(b["url"], "url")

  // score must be a non-negative integer
  if (typeof b["score"] !== "number" || !Number.isInteger(b["score"]) || b["score"] < 0) {
    throw new ValidationError("invalid_score")
  }
  const score = b["score"]

  return { newsId, source, headline, url, score }
}
