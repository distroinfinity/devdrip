import { ValidationError } from "../errors/index.js"

export interface AnalyticsFilters {
  from: Date
  to: Date
  source?: string
  category?: string
  result?: string
}

const DEFAULT_RANGE_DAYS = 30

export function parseAnalyticsQuery(q: Record<string, unknown>): AnalyticsFilters {
  const to = q["to"] ? parseDate(q["to"], "to") : new Date()
  const from = q["from"]
    ? parseDate(q["from"], "from")
    : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 86_400_000)
  if (from > to) throw new ValidationError("invalid_date_range")

  return {
    from,
    to,
    source: optString(q["source"], "source"),
    category: optString(q["category"], "category"),
    result: optString(q["result"], "result"),
  }
}

function parseDate(raw: unknown, field: string): Date {
  if (typeof raw !== "string") throw new ValidationError(`invalid_${field}`)
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) throw new ValidationError(`invalid_${field}`)
  return d
}

function optString(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== "string") throw new ValidationError(`invalid_${field}`)
  return raw
}
