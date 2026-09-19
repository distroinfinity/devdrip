// Single SQL INSERT...SELECT for the weekly auto-disburse cron. Selects
// users with confirmed earnings minus paid+pending payouts ≥ MIN_AUTO_DISBURSE_USDC,
// and inserts one pending payout per user with scheduled_for_week = ISO week
// monday. The unique constraint on (user_id, scheduled_for_week) makes this
// idempotent — re-running within the same week is a no-op.

import { sql } from "drizzle-orm"
import { MIN_AUTO_DISBURSE_USDC } from "@devdrip/shared"
import { getDb } from "../db/index.js"

export interface AutoDisburseSummary {
  inserted: number
}

export async function runAutoDisburse(): Promise<AutoDisburseSummary> {
  const db = getDb()
  const result = await db.execute(sql`
    WITH balances AS (
      SELECT
        u.id AS user_id,
        u.wallet_address,
        COALESCE(e.total, 0) - COALESCE(p.total, 0) AS available
      FROM users u
      LEFT JOIN (
        SELECT user_id, SUM(amount_usdc) AS total
        FROM earnings_ledger
        WHERE status = 'confirmed'
        GROUP BY user_id
      ) e ON e.user_id = u.id
      LEFT JOIN (
        SELECT user_id, SUM(amount_usdc) AS total
        FROM payouts
        WHERE status IN ('pending', 'processing', 'confirmed')
        GROUP BY user_id
      ) p ON p.user_id = u.id
      WHERE u.wallet_address IS NOT NULL
    )
    INSERT INTO payouts (
      user_id, amount_usdc, wallet_address, idempotency_key, scheduled_for_week, status
    )
    SELECT
      b.user_id,
      b.available,
      b.wallet_address,
      gen_random_uuid(),
      date_trunc('week', current_date)::date,
      'pending'
    FROM balances b
    WHERE b.available >= ${MIN_AUTO_DISBURSE_USDC}
    ON CONFLICT (user_id, scheduled_for_week) DO NOTHING
    RETURNING id
  `)
  type Row = { id: string }
  const rows: Row[] =
    "rows" in result ? (result as unknown as { rows: Row[] }).rows : (result as unknown as Row[])
  return { inserted: rows.length }
}
