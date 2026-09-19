import { Router } from "express"
import { eq } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { users } from "../db/schema/users.js"
import { ApiError } from "../errors/index.js"
import { requireMiniAppSession } from "../middleware/miniapp-auth.js"

export const miniappMeRouter: ReturnType<typeof Router> = Router()

// Read-only counterpart to /me, but gated by the Mini App session cookie
// instead of the Bearer token. The signup wizard reads this on every page
// load to decide which step is current (walletAddress null → step 1, nullifier
// null → step 2, githubLogin null → step 3, signedUpAt set → done).
miniappMeRouter.get("/", requireMiniAppSession, async (_req, res, next) => {
  try {
    const userId = res.locals["miniAppUserId"] as string
    const [row] = await getDb()
      .select({
        id: users.id,
        walletAddress: users.walletAddress,
        nullifierHash: users.nullifierHash,
        verificationLevel: users.verificationLevel,
        githubId: users.githubId,
        githubLogin: users.githubLogin,
        email: users.email,
        avatarUrl: users.avatarUrl,
        signedUpAt: users.signedUpAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!row) throw new ApiError(404, "user_not_found")
    res.json({
      id: row.id,
      walletAddress: row.walletAddress,
      nullifierHash: row.nullifierHash,
      verificationLevel: row.verificationLevel,
      githubId: row.githubId,
      githubLogin: row.githubLogin,
      email: row.email,
      avatarUrl: row.avatarUrl,
      signedUpAt: row.signedUpAt?.toISOString() ?? null,
    })
  } catch (err) {
    next(err)
  }
})
