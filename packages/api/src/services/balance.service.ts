import { sql } from "drizzle-orm"
import { getDb } from "../db/index.js"

export interface Balance {
  availableUsdc: number
  lifetimeEarnedUsdc: number
  pendingPayoutsUsdc: number
}

// Single SQL roundtrip. confirmed earnings give the lifetime number; payouts
// in pending/processing/confirmed states are ALL subtracted from available
// (a confirmed payout has already left the wallet; a pending one is committed
// to leaving). Everything is NUMERIC(12,6) on the column side; coalesce(NULL,0)
// returns 0 when the user has no rows at all.
export async function getBalance(userId: string): Promise<Balance> {
  const db = getDb()
  const result = await db.execute(sql`
    WITH earned AS (
      SELECT COALESCE(SUM(amount_usdc), 0)::numeric AS total
      FROM earnings_ledger
      WHERE user_id = ${userId}::uuid AND status = 'confirmed'
    ),
    paid AS (
      SELECT COALESCE(SUM(amount_usdc), 0)::numeric AS total
      FROM payouts
      WHERE user_id = ${userId}::uuid AND status IN ('pending', 'processing', 'confirmed')
    ),
    pend AS (
      SELECT COALESCE(SUM(amount_usdc), 0)::numeric AS total
      FROM payouts
      WHERE user_id = ${userId}::uuid AND status IN ('pending', 'processing')
    )
    SELECT
      GREATEST(earned.total - paid.total, 0)::float8 AS available,
      earned.total::float8 AS lifetime,
      pend.total::float8 AS pending
    FROM earned, paid, pend
  `)
  type BalanceRow = { available: number; lifetime: number; pending: number }
  const rows: BalanceRow[] =
    "rows" in result
      ? (result as unknown as { rows: BalanceRow[] }).rows
      : (result as unknown as BalanceRow[])
  const row = rows[0]
  return {
    availableUsdc: Number(row?.available ?? 0),
    lifetimeEarnedUsdc: Number(row?.lifetime ?? 0),
    pendingPayoutsUsdc: Number(row?.pending ?? 0),
  }
}
