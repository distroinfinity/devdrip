import { ValidationError } from "../errors/index.js"
import {
  decodeCursor,
  LIST_LIMIT_DEFAULT,
  LIST_LIMIT_MAX,
} from "../services/me-impressions.service.js"

export interface ListImpressionsQuery {
  from?: Date
  to?: Date
  source?: string
  result?: string
  category?: string
  limit: number
  cursor?: { createdAt: Date; id: string }
}

export function parseListImpressionsQuery(q: Record<string, unknown>): ListImpressionsQuery {
  const out: ListImpressionsQuery = { limit: LIST_LIMIT_DEFAULT }

  if (q["from"] !== undefined) out.from = parseDate(q["from"], "from")
  if (q["to"] !== undefined) out.to = parseDate(q["to"], "to")
  if (out.from && out.to && out.from > out.to) throw new ValidationError("invalid_date_range")

  if (q["source"] !== undefined) out.source = parseString(q["source"], "source")
  if (q["result"] !== undefined) out.result = parseString(q["result"], "result")
  if (q["category"] !== undefined) out.category = parseString(q["category"], "category")

  if (q["limit"] !== undefined) {
    const n = Number(q["limit"])
    if (!Number.isInteger(n) || n < 1 || n > LIST_LIMIT_MAX) {
      throw new ValidationError("invalid_limit")
    }
    out.limit = n
  }

  if (q["cursor"] !== undefined) {
    const raw = q["cursor"]
    if (typeof raw !== "string" || raw.length === 0) throw new ValidationError("invalid_cursor")
    out.cursor = decodeCursor(raw)
  }

  return out
}

function parseDate(raw: unknown, field: string): Date {
  if (typeof raw !== "string") throw new ValidationError(`invalid_${field}`)
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) throw new ValidationError(`invalid_${field}`)
  return d
}

function parseString(raw: unknown, field: string): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 64) {
    throw new ValidationError(`invalid_${field}`)
  }
  return raw
}
