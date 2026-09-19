import { eq, desc, count } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { payouts } from "../db/schema/payouts.js"
import { NotFoundError, StateError, ConflictError, pgErrorCode } from "../errors/index.js"
import type {
  AdminPayoutStatus,
  SetPayoutStatusInput,
} from "../validators/admin-payout.validators.js"

// operator overrides are only valid from non-terminal states. we intentionally
// allow forcing "confirmed" from "pending" too (e.g. out-of-band settlement).
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "failed"],
  processing: ["confirmed", "failed"],
  confirmed: [],
  failed: [],
}

export async function list(status: AdminPayoutStatus | undefined, limit: number, offset: number) {
  const db = getDb()
  const where = status ? eq(payouts.status, status) : undefined
  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(payouts)
      .where(where)
      .orderBy(desc(payouts.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(payouts).where(where),
  ])
  return { payouts: rows, total: totalRow?.count ?? 0 }
}

export async function setStatus(id: string, input: SetPayoutStatusInput) {
  const db = getDb()
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(payouts).where(eq(payouts.id, id)).for("update")
    if (!current) throw new NotFoundError("payout")

    const allowed = ALLOWED_TRANSITIONS[current.status] ?? []
    if (!allowed.includes(input.status)) {
      throw new StateError("invalid_status_transition", {
        from: current.status,
        to: input.status,
      })
    }

    const now = new Date()
    try {
      const [updated] = await tx
        .update(payouts)
        .set({
          status: input.status,
          txHash: input.txHash ?? current.txHash,
          failureReason: input.failureReason ?? current.failureReason,
          confirmedAt: input.status === "confirmed" ? now : current.confirmedAt,
          updatedAt: now,
        })
        .where(eq(payouts.id, id))
        .returning()
      if (!updated) throw new NotFoundError("payout")
      return updated
    } catch (err) {
      if (pgErrorCode(err) === "23505") throw new ConflictError("tx_hash_already_used")
      throw err
    }
  })
}
