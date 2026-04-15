import type { Request, Response, NextFunction } from "express"
import { env } from "../config/env.js"
import { logger } from "../lib/logger.js"

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  let secret: string
  try {
    secret = env.adminSecret
  } catch (err) {
    logger.error({ err }, "ADMIN_SECRET not configured")
    res.status(403).json({ error: "forbidden" })
    return
  }

  const header = req.headers["x-admin-secret"]
  if (!header || header !== secret) {
    res.status(403).json({ error: "forbidden" })
    return
  }
  next()
}
