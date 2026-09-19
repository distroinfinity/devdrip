import { Router } from "express"
import { env } from "../config/env.js"
import { requireMiniAppSession } from "../middleware/miniapp-auth.js"
import { completeMiniAppSignup } from "../services/miniapp-signup.service.js"
import { signMiniAppSession } from "../lib/miniapp-jwt.js"
import { setMiniAppCookie } from "./miniapp-auth.js"

export const miniappSignupRouter: ReturnType<typeof Router> = Router()

miniappSignupRouter.post("/complete", requireMiniAppSession, async (_req, res, next) => {
  try {
    const userId = res.locals["miniAppUserId"] as string
    const { alreadyComplete } = await completeMiniAppSignup(userId)

    // Re-mint the cookie with signup=true so subsequent /miniapp/cli-link calls
    // can use requireCompletedMiniAppSession.
    const token = await signMiniAppSession({ sub: userId, signup: true }, env.jwtSecret)
    setMiniAppCookie(res, token)
    res.json({ user_id: userId, already_complete: alreadyComplete })
  } catch (err) {
    next(err)
  }
})
