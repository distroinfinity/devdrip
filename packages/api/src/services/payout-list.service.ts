import { and, desc, eq, lt, or, sql } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { payouts } from "../db/schema/payouts.js"
import { ApiError } from "../errors/index.js"
import type { ListPayoutsCursor } from "../validators/me-payouts.validators.js"

export interface PayoutSummary {
  id: string
  status: string
  amountUsdc: number
  walletAddress: string
  txHash: string | null
  txBlockNumber: number | null
  failureReason: string | null
  createdAt: string
  confirmedAt: string | null
}

export async function getPayout(userId: string, payoutId: string): Promise<PayoutSummary> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(payouts)
    .where(and(eq(payouts.id, payoutId), eq(payouts.userId, userId)))
    .limit(1)
  if (!row) throw new ApiError(404, "payout_not_found")
  return shape(row)
}

export interface PayoutListResult {
  items: PayoutSummary[]
  nextCursor: string | null
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

// Cursor is `<createdAt-iso>|<uuid>` of the last row in the previous page.
// Order is `(created_at DESC, id DESC)` so the (createdAt, id) tuple gives a
// total order — no skipped/duplicated rows when batch inserts (auto-disburse
// cron) produce same-microsecond timestamps.
export async function listPayouts(
  userId: string,
  opts: { cursor?: ListPayoutsCursor; limit?: number }
): Promise<PayoutListResult> {
  const db = getDb()
  const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT)

  const conditions = [eq(payouts.userId, userId)]
  if (opts.cursor) {
    const cursorDate = new Date(opts.cursor.createdAt)
    if (isNaN(cursorDate.getTime())) throw new ApiError(400, "invalid_cursor")
    const tuple = or(
      lt(payouts.createdAt, cursorDate),
      and(eq(payouts.createdAt, cursorDate), lt(payouts.id, sql`${opts.cursor.id}::uuid`))
    )
    if (tuple) conditions.push(tuple)
  }

  const rows = await db
    .select()
    .from(payouts)
    .where(and(...conditions))
    .orderBy(desc(payouts.createdAt), desc(payouts.id))
    .limit(limit + 1)

  const items = rows.slice(0, limit).map(shape)
  const lastIncluded = rows[limit - 1]
  const nextCursor =
    rows.length > limit && lastIncluded
      ? `${lastIncluded.createdAt.toISOString()}|${lastIncluded.id}`
      : null
  return { items, nextCursor }
}

function shape(row: typeof payouts.$inferSelect): PayoutSummary {
  return {
    id: row.id,
    status: row.status,
    amountUsdc: row.amountUsdc,
    walletAddress: row.walletAddress,
    txHash: row.txHash,
    txBlockNumber: row.txBlockNumber,
    failureReason: row.failureReason,
    createdAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
  }
}
