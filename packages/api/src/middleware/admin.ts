import { timingSafeEqual } from "node:crypto"
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
  if (typeof header !== "string") {
    res.status(403).json({ error: "forbidden" })
    return
  }

  const headerBuf = Buffer.from(header)
  const secretBuf = Buffer.from(secret)
  // timingSafeEqual throws on mismatched lengths; the length-check itself is
  // intentionally timing-unsafe since only equal-length inputs need protection
  if (headerBuf.length !== secretBuf.length || !timingSafeEqual(headerBuf, secretBuf)) {
    res.status(403).json({ error: "forbidden" })
    return
  }
  next()
}
