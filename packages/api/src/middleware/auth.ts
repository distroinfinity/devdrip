import type { Request, Response, NextFunction } from "express"
import { verifyAccessToken, joseErrors } from "../lib/jwt.js"
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
