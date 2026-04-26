import { Router } from "express"
import type { Response } from "express"
import { eq } from "drizzle-orm"
import { env } from "../config/env.js"
import {
  signMiniAppSession,
  MINIAPP_COOKIE_NAME,
  MINIAPP_COOKIE_MAX_AGE,
  MINIAPP_COOKIE_PATH,
} from "../lib/miniapp-jwt.js"
import { mintWalletAuthNonce, verifyWalletAuth } from "../services/walletauth.service.js"
import { parseWalletAuthVerify } from "../validators/miniapp.validators.js"
import { getDb } from "../db/index.js"
import { users } from "../db/schema/users.js"

export const miniappAuthRouter: ReturnType<typeof Router> = Router()

miniappAuthRouter.post("/nonce", async (_req, res, next) => {
  try {
    const nonce = await mintWalletAuthNonce()
    res.json({ nonce })
  } catch (err) {
    next(err)
  }
})

miniappAuthRouter.post("/verify", async (req, res, next) => {
  try {
    const { payload, nonce } = parseWalletAuthVerify(req.body)
    const { userId, walletAddress } = await verifyWalletAuth({ payload: payload as never, nonce })

    // Returning users get a "signup complete" token immediately so they can hit
    // /miniapp/cli-link/:code without a redundant signup-complete round-trip.
    const [u] = await getDb()
      .select({ signedUpAt: users.signedUpAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    const signupComplete = !!u?.signedUpAt
    const token = await signMiniAppSession({ sub: userId, signup: signupComplete }, env.jwtSecret)
    setMiniAppCookie(res, token)
    res.json({ user_id: userId, world_wallet_address: walletAddress })
  } catch (err) {
    next(err)
  }
})

function setMiniAppCookie(res: Response, token: string) {
  res.cookie(MINIAPP_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    path: MINIAPP_COOKIE_PATH,
    maxAge: MINIAPP_COOKIE_MAX_AGE * 1000,
    domain: env.miniAppCookieDomain || undefined,
  })
}

// Re-exported for use by other miniapp-* routes that need to refresh the cookie
// (e.g., /miniapp/signup/complete bumps signup to true).
export { setMiniAppCookie }
