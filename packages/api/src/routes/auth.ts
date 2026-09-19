import { Router } from "express"
import { eq } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { users } from "../db/schema/users.js"
import { requireAuth } from "../middleware/auth.js"

// Sign-in lives in the dashboard (`/auth/github/start` + `/auth/github/callback`),
// not on the API. This router exposes only `/auth/me` for clients that want a
// lightweight identity probe with an existing bearer.

export const authRouter: ReturnType<typeof Router> = Router()

// ── GET /auth/me ────────────────────────────────────────────────────────────
// lightweight user lookup for CLI post-init confirmation + dashboard probe
authRouter.get("/me", requireAuth, async (_req, res) => {
  const userId = res.locals["userId"] as string
  const [row] = await getDb()
    .select({ id: users.id, githubLogin: users.githubLogin, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!row) {
    await res.status(404).json({ error: "user_not_found" })
    return
  }
  await res.json(row)
})
