// Settlement loop — every TICK_MS, claims one pending payout via
// FOR UPDATE SKIP LOCKED, marks it processing inside the same transaction,
// and hands it off to broadcastPayout (which holds no lock during the receipt
// poll). The lock window is just the SELECT+UPDATE — broadcast happens after.

import { sql } from "drizzle-orm"
import type { Hex } from "viem"
import { getDb } from "../db/index.js"
import { logger } from "../lib/logger.js"
import { broadcastPayout, type PendingPayout } from "../services/payout-broadcast.service.js"

const TICK_MS = 30_000

interface ClaimRow {
  id: string
  user_id: string
  wallet_address: string
  amount_usdc: number
  retry_count: number
  tx_hash: string | null
}

export async function claimNextPending(): Promise<PendingPayout | null> {
  const db = getDb()
  return await db.transaction(async (tx) => {
    // Picks up `pending` rows AND `processing` rows older than 5 minutes
    // (crash recovery — if a worker dies mid-broadcast, the row would otherwise
    // be stuck in 'processing' forever). 5 min is comfortably longer than the
    // 30s receipt timeout × max_retries=3 envelope.
    //
    // tx_hash is carried forward so broadcastPayout can take the
    // reconciliation-only path when a previous attempt already broadcast a tx.
    const result = await tx.execute(sql`
      SELECT id, user_id, wallet_address, amount_usdc, retry_count, tx_hash
      FROM payouts
      WHERE status = 'pending'
         OR (status = 'processing' AND updated_at < now() - interval '5 minutes')
      ORDER BY created_at, id
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `)
    const rows: ClaimRow[] =
      "rows" in result
        ? (result as unknown as { rows: ClaimRow[] }).rows
        : (result as unknown as ClaimRow[])
    const row = rows[0]
    if (!row) return null
    await tx.execute(sql`
      UPDATE payouts SET status = 'processing', updated_at = now()
      WHERE id = ${row.id}::uuid
    `)
    return {
      id: row.id,
      userId: row.user_id,
      walletAddress: row.wallet_address,
      amountUsdc: Number(row.amount_usdc),
      retryCount: row.retry_count,
      txHash: row.tx_hash as Hex | null,
    }
  })
}

export async function processOnce(): Promise<boolean> {
  const row = await claimNextPending()
  if (!row) return false
  await broadcastPayout(row)
  return true
}

let stopRequested = false
let activeTick: Promise<void> | null = null

export function startSettlementLoop(): void {
  logger.info({ tickMs: TICK_MS }, "settlement loop starting")
  const tick = async (): Promise<void> => {
    if (stopRequested) return
    try {
      while (await processOnce()) {
        if (stopRequested) return
      }
    } catch (err) {
      logger.error({ err }, "settlement tick failed")
    }
  }
  const interval = setInterval(() => {
    if (activeTick) return
    activeTick = tick().finally(() => {
      activeTick = null
    })
  }, TICK_MS)
  interval.unref()
  // First tick immediately so a fresh worker picks up backlog without waiting 30s
  activeTick = tick().finally(() => {
    activeTick = null
  })
}

export function stopSettlementLoop(): Promise<void> {
  stopRequested = true
  return activeTick ?? Promise.resolve()
}
