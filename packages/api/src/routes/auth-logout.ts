import { Router } from "express"
import { eq } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { devices } from "../db/schema/devices.js"
import { requireAuth } from "../middleware/auth.js"

export const authLogoutRouter: ReturnType<typeof Router> = Router()

// POST /auth/logout
// CLI bearer (device.<secret>) → delete the device row
// JWT bearer (dashboard)        → no-op server-side; dashboard clears its cookie
authLogoutRouter.post("/", requireAuth, async (_req, res) => {
  const deviceId = res.locals["deviceId"] as string | undefined
  if (deviceId) {
    await getDb().delete(devices).where(eq(devices.id, deviceId))
  }
  await res.status(200).json({ ok: true })
})
