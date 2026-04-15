import type { Request, Response, NextFunction } from "express"
import { env } from "../config/env.js"

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers["x-admin-secret"]
  if (!secret || secret !== env.adminSecret) {
    await res.status(403).json({ error: "forbidden" })
    return
  }
  next()
}
