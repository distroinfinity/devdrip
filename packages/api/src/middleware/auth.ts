import type { Request, Response, NextFunction } from "express"
import { verifyAccessToken, joseErrors } from "../lib/jwt.js"
import { verifyMiniAppSession, miniAppJoseErrors, MINIAPP_COOKIE_NAME } from "../lib/miniapp-jwt.js"
import { env } from "../config/env.js"

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith("Bearer ")) {
    await res.status(401).json({ error: "missing_token" })
    return
  }

  const token = header.slice(7)
  try {
    const payload = await verifyAccessToken(token, env.jwtSecret)
    res.locals["userId"] = payload.sub
    res.locals["githubLogin"] = payload.github_login
    next()
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      await res.status(401).json({ error: "token_expired" })
    } else {
      await res.status(401).json({ error: "invalid_token" })
    }
  }
}

// Accepts either the Bearer access token (CLI/dashboard) OR the dd_miniapp
// cookie (Mini App). Both resolve to the same userId in res.locals so
// downstream handlers don't care which surface authenticated. Used by
// /me/balance and /me/payouts where the Mini App wallet page reads the
// same user-scoped data the CLI/dashboard already read.
export async function requireBearerOrMiniApp(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7)
    try {
      const payload = await verifyAccessToken(token, env.jwtSecret)
      res.locals["userId"] = payload.sub
      res.locals["githubLogin"] = payload.github_login
      next()
      return
    } catch (err) {
      if (err instanceof joseErrors.JWTExpired) {
        await res.status(401).json({ error: "token_expired" })
        return
      }
      // Bearer present but invalid → don't silently fall through to cookie;
      // surface the explicit failure so a stale CLI token doesn't get masked.
      await res.status(401).json({ error: "invalid_token" })
      return
    }
  }

  const cookie = req.cookies[MINIAPP_COOKIE_NAME] as string | undefined
  if (!cookie) {
    await res.status(401).json({ error: "missing_token" })
    return
  }
  try {
    const payload = await verifyMiniAppSession(cookie, env.jwtSecret)
    res.locals["userId"] = payload.sub
    next()
  } catch (err) {
    if (err instanceof miniAppJoseErrors.JWTExpired) {
      await res.status(401).json({ error: "miniapp_session_expired" })
    } else {
      await res.status(401).json({ error: "invalid_miniapp_session" })
    }
  }
}
