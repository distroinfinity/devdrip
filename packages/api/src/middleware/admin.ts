import type { Request, Response, NextFunction } from "express"
import { eq } from "drizzle-orm"
import { env } from "../config/env.js"
import { getDb } from "../db/index.js"
import { users } from "../db/schema/users.js"
import { logger } from "../lib/logger.js"

// Admin gate: requires the user is authenticated AND their email is listed in
// ADMIN_EMAILS. Chain after requireAuth.
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (env.adminEmails.size === 0) {
    res.status(503).json({ error: "admin_disabled" })
    return
  }
  const userId = res.locals["userId"] as string | undefined
  if (!userId) {
    res.status(401).json({ error: "unauthorized" })
    return
  }
  try {
    const rows = await getDb()
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    const email = rows[0]?.email?.toLowerCase()
    if (!email || !env.adminEmails.has(email)) {
      res.status(403).json({ error: "not_admin" })
      return
    }
    next()
  } catch (err) {
    logger.error({ err: String(err) }, "requireAdmin lookup failed")
    res.status(500).json({ error: "internal_error" })
  }
}
