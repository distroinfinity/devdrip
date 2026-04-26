import { eq, sql } from "drizzle-orm"
import { MIN_PAYOUT_USDC } from "@devdrip/shared"
import { getDb } from "../db/index.js"
import { payouts } from "../db/schema/payouts.js"
import { users } from "../db/schema/users.js"
import { ApiError, ValidationError } from "../errors/index.js"

export interface ClaimResult {
  id: string
  status: string
  amountUsdc: number
  walletAddress: string
}

export async function createClaim(userId: string, idempotencyKey: string): Promise<ClaimResult> {
  const db = getDb()

  return await db.transaction(async (tx) => {
    // Per-user advisory lock — released at transaction end. Concurrent claims
    // for the same user serialize here so two callers can't both read the same
    // available balance and both insert pending payouts for the full amount.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"claim:" + userId}))`)

    // Idempotency replay: if a payout already exists for this key, return it.
    const [existing] = await tx
      .select()
      .from(payouts)
      .where(eq(payouts.idempotencyKey, idempotencyKey))
      .limit(1)
    if (existing) {
      if (existing.userId !== userId) {
        throw new ApiError(409, "idempotency_key_belongs_to_other_user")
      }
      return {
        id: existing.id,
        status: existing.status,
        amountUsdc: existing.amountUsdc,
        walletAddress: existing.walletAddress,
      }
    }

    // User must exist and have a wallet bound.
    const [user] = await tx
      .select({ walletAddress: users.walletAddress })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!user) throw new ApiError(404, "user_not_found")
    if (!user.walletAddress) throw new ValidationError("wallet_not_bound")

    // Compute available balance INSIDE the lock so concurrent claims see each
    // other's pending payouts. Same CTE as services/balance.service.ts but
    // executed via the transaction handle.
    const balResult = await tx.execute(sql`
      WITH earned AS (
        SELECT COALESCE(SUM(amount_usdc), 0)::numeric AS total
        FROM earnings_ledger
        WHERE user_id = ${userId}::uuid AND status = 'confirmed'
      ),
      paid AS (
        SELECT COALESCE(SUM(amount_usdc), 0)::numeric AS total
        FROM payouts
        WHERE user_id = ${userId}::uuid AND status IN ('pending', 'processing', 'confirmed')
      )
      SELECT GREATEST(earned.total - paid.total, 0)::float8 AS available
      FROM earned, paid
    `)
    type Row = { available: number }
    const rows: Row[] =
      "rows" in balResult
        ? (balResult as unknown as { rows: Row[] }).rows
        : (balResult as unknown as Row[])
    const availableUsdc = Number(rows[0]?.available ?? 0)

    if (availableUsdc < MIN_PAYOUT_USDC) {
      throw new ValidationError("balance_below_minimum")
    }

    const [created] = await tx
      .insert(payouts)
      .values({
        userId,
        amountUsdc: availableUsdc,
        walletAddress: user.walletAddress,
        idempotencyKey,
        status: "pending",
      })
      .returning()
    if (!created) throw new ApiError(500, "payout_insert_failed")

    return {
      id: created.id,
      status: created.status,
      amountUsdc: created.amountUsdc,
      walletAddress: created.walletAddress,
    }
  })
}
