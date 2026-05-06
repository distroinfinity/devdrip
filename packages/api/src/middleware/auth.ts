import type { Request, Response, NextFunction } from "express"
import { eq } from "drizzle-orm"
import { verifyAccessToken, joseErrors } from "../lib/jwt.js"
import { hashSecret } from "../lib/secret-hash.js"
import { getDb } from "../db/index.js"
import { devices } from "../db/schema/devices.js"
import { env } from "../config/env.js"

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith("Bearer ")) {
    await res.status(401).json({ error: "missing_token" })
    return
  }

  const token = header.slice(7).trim()

  // device-secret path: "Bearer device.<secret>"
  if (token.startsWith("device.")) {
    const secret = token.slice("device.".length)
    const hash = hashSecret(secret)
    try {
      const [device] = await getDb()
        .select({ id: devices.id, userId: devices.userId })
        .from(devices)
        .where(eq(devices.deviceSecretHash, hash))
        .limit(1)

      if (!device) {
        await res.status(401).json({ error: "invalid_device_token" })
        return
      }

      res.locals["userId"] = device.userId
      res.locals["deviceId"] = device.id
      next()
    } catch {
      await res.status(401).json({ error: "invalid_device_token" })
    }
    return
  }

  // JWT path: existing logic unchanged
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
