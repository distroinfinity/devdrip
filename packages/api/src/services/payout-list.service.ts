import { and, desc, eq, lt } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { payouts } from "../db/schema/payouts.js"
import { ApiError } from "../errors/index.js"

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

// Cursor is the createdAt ISO string of the last row in the previous page —
// next page returns rows STRICTLY older than the cursor.
export async function listPayouts(
  userId: string,
  opts: { cursor?: string; limit?: number }
): Promise<PayoutListResult> {
  const db = getDb()
  const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT)

  const conditions = [eq(payouts.userId, userId)]
  if (opts.cursor) {
    const cursorDate = new Date(opts.cursor)
    if (isNaN(cursorDate.getTime())) throw new ApiError(400, "invalid_cursor")
    conditions.push(lt(payouts.createdAt, cursorDate))
  }

  const rows = await db
    .select()
    .from(payouts)
    .where(and(...conditions))
    .orderBy(desc(payouts.createdAt))
    .limit(limit + 1)

  const items = rows.slice(0, limit).map(shape)
  const nextCursor = rows.length > limit ? (rows[limit - 1]?.createdAt.toISOString() ?? null) : null
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
