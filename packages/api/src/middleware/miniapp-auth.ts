import type { Request, Response, NextFunction } from "express"
import { env } from "../config/env.js"
import { verifyMiniAppSession, miniAppJoseErrors, MINIAPP_COOKIE_NAME } from "../lib/miniapp-jwt.js"

// Reads the Mini App session cookie, verifies the JWT, populates res.locals.
// Used by every /miniapp/* endpoint EXCEPT walletAuth nonce/verify and the
// GitHub OAuth start route (which establish the session).
export async function requireMiniAppSession(req: Request, res: Response, next: NextFunction) {
  const cookie = req.cookies[MINIAPP_COOKIE_NAME] as string | undefined
  if (!cookie) {
    await res.status(401).json({ error: "missing_miniapp_session" })
    return
  }
  try {
    const payload = await verifyMiniAppSession(cookie, env.jwtSecret)
    res.locals["miniAppUserId"] = payload.sub
    res.locals["miniAppSignupComplete"] = payload.signup
    next()
  } catch (err) {
    if (err instanceof miniAppJoseErrors.JWTExpired) {
      await res.status(401).json({ error: "miniapp_session_expired" })
    } else {
      await res.status(401).json({ error: "invalid_miniapp_session" })
    }
  }
}

// Strict variant: only completed signups can hit this. Used by /miniapp/cli-link/:code.
export async function requireCompletedMiniAppSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  await requireMiniAppSession(req, res, () => {
    if (res.locals["miniAppSignupComplete"] !== true) {
      void res.status(403).json({ error: "signup_incomplete" })
      return
    }
    next()
  })
}
