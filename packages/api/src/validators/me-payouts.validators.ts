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

export interface ListPayoutsQuery {
  cursor?: string
  limit?: number
}

export function parseListPayoutsQuery(query: Record<string, unknown>): ListPayoutsQuery {
  const cursor = typeof query["cursor"] === "string" ? query["cursor"] : undefined
  let limit: number | undefined
  if (query["limit"] !== undefined) {
    const n = Number(query["limit"])
    if (!Number.isInteger(n) || n < 1 || n > 100) throw new ValidationError("invalid_limit")
    limit = n
  }
  return { cursor, limit }
}
