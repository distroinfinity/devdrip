import { eq, sql } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { users } from "../db/schema/users.js"
import { ApiError } from "../errors/index.js"

export interface CompleteSignupResult {
  userId: string
  alreadyComplete: boolean
}

// Atomic flip from "all 3 credentials bound" to signed_up_at=now(). Returns
// alreadyComplete=true if signed_up_at was already set (idempotent on re-call).
export async function completeMiniAppSignup(userId: string): Promise<CompleteSignupResult> {
  const db = getDb()
  const [row] = await db
    .select({
      id: users.id,
      walletAddress: users.walletAddress,
      nullifierHash: users.nullifierHash,
      githubId: users.githubId,
      signedUpAt: users.signedUpAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!row) throw new ApiError(404, "user_not_found")

  if (row.signedUpAt) return { userId, alreadyComplete: true }

  const missing: string[] = []
  if (!row.walletAddress) missing.push("wallet")
  if (!row.nullifierHash) missing.push("world_id")
  if (!row.githubId) missing.push("github")
  if (missing.length > 0) {
    throw new ApiError(400, "signup_incomplete", { missing })
  }

  await db
    .update(users)
    .set({ signedUpAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(users.id, userId))

  return { userId, alreadyComplete: false }
}
