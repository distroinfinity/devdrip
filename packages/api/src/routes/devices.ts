import { Router } from "express"
import { eq } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { devices } from "../db/schema/devices.js"
import { users } from "../db/schema/users.js"
import { logger } from "../lib/logger.js"
import { generateReferralCode } from "../lib/referral.js"
import { generateDeviceSecret, hashSecret } from "../lib/secret-hash.js"

// ── POST /devices/register (public — no auth required) ──────────────────────
// Creates an anonymous user + device. Returns the raw device secret — lost
// forever after this response. Caller stores it as Bearer device.<secret>.

export const devicesRegisterRouter: ReturnType<typeof Router> = Router()

devicesRegisterRouter.post("/", async (req, res) => {
  const { name, ideType, platform } = req.body as {
    name?: string
    ideType?: string
    platform?: string
    hostname?: string
  }

  const db = getDb()

  try {
    // create anonymous user (email/github_id null until M2 magic-link)
    const referralCode = generateReferralCode()
    const [user] = await db
      .insert(users)
      .values({
        email: null,
        githubId: null,
        githubLogin: null,
        referralCode,
      })
      .returning()

    if (!user) {
      await res.status(500).json({ error: "internal_error" })
      return
    }

    // generate + hash device secret
    const deviceSecret = generateDeviceSecret()
    const deviceSecretHash = hashSecret(deviceSecret)

    const [device] = await db
      .insert(devices)
      .values({
        userId: user.id,
        // anon registration doesn't require machineIdHash — use empty sentinel
        // so the existing unique index (userId, machineIdHash) stays happy.
        // M2 CLI pair flow can update this once a real machine hash is known.
        machineIdHash: deviceSecretHash.slice(0, 64),
        deviceName: typeof name === "string" && name.length > 0 ? name.slice(0, 255) : null,
        os: typeof platform === "string" && platform.length > 0 ? platform.slice(0, 50) : "unknown",
        ideType:
          ideType === "vscode" || ideType === "cursor" || ideType === "terminal"
            ? ideType
            : "terminal",
        deviceSecretHash,
        lastHeartbeat: new Date(),
      })
      .returning()

    if (!device) {
      await res.status(500).json({ error: "internal_error" })
      return
    }

    await res.status(201).json({
      userId: user.id,
      deviceId: device.id,
      deviceSecret,
    })
  } catch (err) {
    logger.error({ err }, "device register error")
    await res.status(500).json({ error: "internal_error" })
  }
})

// ── POST /devices (authed — updates/re-registers a device) ──────────────────
// Requires requireAuth; reads res.locals.userId set by auth middleware.

const MACHINE_ID_HASH_RE = /^[0-9a-f]{64}$/
const VALID_OS = ["darwin", "linux", "win32"] as const
const VALID_IDE_TYPES = ["terminal", "vscode", "cursor"] as const

import { authLimiter } from "../middleware/rate-limit.js"

export const devicesRouter: ReturnType<typeof Router> = Router()

devicesRouter.post("/", authLimiter, async (_req, res) => {
  const userId = res.locals["userId"] as string
  const { machineIdHash, os, ideType, deviceName } = _req.body as {
    machineIdHash?: string
    os?: string
    ideType?: string
    deviceName?: string
  }

  if (!machineIdHash || !MACHINE_ID_HASH_RE.test(machineIdHash)) {
    await res.status(400).json({ error: "invalid_machine_id_hash" })
    return
  }
  if (!os || !(VALID_OS as readonly string[]).includes(os)) {
    await res.status(400).json({ error: "invalid_os" })
    return
  }
  if (!ideType || !(VALID_IDE_TYPES as readonly string[]).includes(ideType)) {
    await res.status(400).json({ error: "invalid_ide_type" })
    return
  }
  if (
    deviceName !== undefined &&
    (typeof deviceName !== "string" || deviceName.length === 0 || deviceName.length > 255)
  ) {
    await res.status(400).json({ error: "invalid_device_name" })
    return
  }

  const db = getDb()
  const now = new Date()

  const conflictSet: Record<string, unknown> = {
    os,
    ideType: ideType as "terminal" | "vscode" | "cursor",
    lastHeartbeat: now,
  }
  if (deviceName !== undefined) {
    conflictSet["deviceName"] = deviceName
  }

  try {
    const [device] = await db
      .insert(devices)
      .values({
        userId,
        machineIdHash,
        os,
        ideType: ideType as "terminal" | "vscode" | "cursor",
        deviceName: deviceName ?? null,
        lastHeartbeat: now,
      })
      .onConflictDoUpdate({
        target: [devices.userId, devices.machineIdHash],
        set: conflictSet,
      })
      .returning()

    if (!device) {
      await res.status(500).json({ error: "internal_error" })
      return
    }

    await res.json({
      device: {
        id: device.id,
        userId: device.userId,
        deviceName: device.deviceName,
        os: device.os,
        ideType: device.ideType,
        lastHeartbeat: device.lastHeartbeat?.toISOString() ?? null,
        createdAt: device.createdAt.toISOString(),
      },
    })
  } catch (err) {
    logger.error({ err }, "device registration error")
    await res.status(500).json({ error: "internal_error" })
  }
})

// GET /devices — list all devices for the authed user
devicesRouter.get("/", async (_req, res) => {
  const userId = res.locals["userId"] as string
  const db = getDb()

  try {
    const rows = await db
      .select({
        id: devices.id,
        userId: devices.userId,
        deviceName: devices.deviceName,
        os: devices.os,
        ideType: devices.ideType,
        lastHeartbeat: devices.lastHeartbeat,
        createdAt: devices.createdAt,
      })
      .from(devices)
      .where(eq(devices.userId, userId))

    await res.json({
      devices: rows.map((d) => ({
        ...d,
        lastHeartbeat: d.lastHeartbeat?.toISOString() ?? null,
        createdAt: d.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    logger.error({ err }, "device list error")
    await res.status(500).json({ error: "internal_error" })
  }
})
