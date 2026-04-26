import { eq } from "drizzle-orm"
import { MIN_PAYOUT_USDC } from "@devdrip/shared"
import { getDb } from "../db/index.js"
import { payouts } from "../db/schema/payouts.js"
import { users } from "../db/schema/users.js"
import { ApiError, ValidationError } from "../errors/index.js"
import { getBalance } from "./balance.service.js"

export interface ClaimResult {
  id: string
  status: string
  amountUsdc: number
  walletAddress: string
}

export async function createClaim(userId: string, idempotencyKey: string): Promise<ClaimResult> {
  const db = getDb()

  // Idempotent replay: if a payout already exists for this key, return it.
  // The plan calls for "scoped to user" — uniqueness on idempotency_key is
  // global across the table, so we additionally verify ownership.
  const [existing] = await db
    .select()
    .from(payouts)
    .where(eq(payouts.idempotencyKey, idempotencyKey))
    .limit(1)
  if (existing) {
    if (existing.userId !== userId) throw new ApiError(409, "idempotency_key_belongs_to_other_user")
    return {
      id: existing.id,
      status: existing.status,
      amountUsdc: existing.amountUsdc,
      walletAddress: existing.walletAddress,
    }
  }

  const [user] = await db
    .select({ walletAddress: users.walletAddress })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!user) throw new ApiError(404, "user_not_found")
  if (!user.walletAddress) throw new ValidationError("wallet_not_bound")

  const balance = await getBalance(userId)
  if (balance.availableUsdc < MIN_PAYOUT_USDC) {
    throw new ValidationError("balance_below_minimum")
  }

  const [created] = await db
    .insert(payouts)
    .values({
      userId,
      amountUsdc: balance.availableUsdc,
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
}
