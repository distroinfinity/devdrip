import { ValidationError } from "../errors/index.js"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseIdempotencyKey(raw: unknown): string {
  if (typeof raw !== "string") throw new ValidationError("missing_idempotency_key")
  if (!UUID_RE.test(raw)) throw new ValidationError("invalid_idempotency_key")
  return raw.toLowerCase()
}

export function parsePayoutIdParam(raw: unknown): string {
  if (typeof raw !== "string" || !UUID_RE.test(raw)) throw new ValidationError("invalid_payout_id")
  return raw.toLowerCase()
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

export interface ListPayoutsCursor {
  createdAt: string
  id: string
}

export interface ListPayoutsQuery {
  cursor?: ListPayoutsCursor
  limit?: number
}

// Cursor format: "<createdAt-iso>|<uuid>". The id tiebreaker prevents two
// payouts with identical created_at from being skipped or duplicated across
// page boundaries — the auto-disburse cron does a batch INSERT...SELECT that
// can stamp many rows with the same microsecond.
export function parseListPayoutsQuery(query: Record<string, unknown>): ListPayoutsQuery {
  const rawCursor = typeof query["cursor"] === "string" ? query["cursor"] : undefined
  let cursor: ListPayoutsCursor | undefined
  if (rawCursor) {
    const parts = rawCursor.split("|")
    if (parts.length !== 2) throw new ValidationError("invalid_cursor")
    const [iso, id] = parts
    if (!iso || !ISO_RE.test(iso)) throw new ValidationError("invalid_cursor")
    if (!id || !UUID_RE.test(id)) throw new ValidationError("invalid_cursor")
    cursor = { createdAt: iso, id: id.toLowerCase() }
  }
  let limit: number | undefined
  if (query["limit"] !== undefined) {
    const n = Number(query["limit"])
    if (!Number.isInteger(n) || n < 1 || n > 100) throw new ValidationError("invalid_limit")
    limit = n
  }
  return { cursor, limit }
}
