import { Router } from "express"
import { getDb } from "../db/index.js"
import { users } from "../db/schema/users.js"
import { generateReferralCode } from "../lib/referral.js"
import { linkPairSession } from "../services/cli-pair.service.js"
import { env } from "../config/env.js"

export const testHelpersRouter: ReturnType<typeof Router> = Router()

// Test-only endpoint. Gated to non-production at the mount site in app.ts
// AND defensively guarded here. Used by the daemon-compat integration test
// to set up a paired pair_session without going through the full Mini App
// auth flow (walletAuth + World ID + GitHub OAuth all need real upstream
// services that aren't available in CI).
testHelpersRouter.post("/setup-paired-link", async (req, res, next) => {
  if (env.nodeEnv === "production") {
    res.status(404).json({ error: "not_found" })
    return
  }
  try {
    const { code, userId, githubLogin } = req.body as {
      code: string
      userId: string
      githubLogin: string
    }
    const db = getDb()
    await db
      .insert(users)
      .values({
        id: userId,
        email: `${githubLogin}@test.local`,
        githubLogin,
        githubId: Math.floor(Math.random() * 1_000_000_000),
        walletAddress: "0x0000000000000000000000000000000000000001",
        referralCode: generateReferralCode(),
      })
      .onConflictDoNothing()
    await linkPairSession(code, userId)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
