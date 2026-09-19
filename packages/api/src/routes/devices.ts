import { Router } from "express"
import { eq } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { devices } from "../db/schema/devices.js"
import { logger } from "../lib/logger.js"

// ── POST /devices/register ──────────────────────────────────────────────────
// Returns 410 Gone — anon device registration was removed in the github-oauth
// cutover (2026-05-22). Old `cli-v0.1.x` clients hit this endpoint; surface a
// clear "upgrade your CLI" message instead of a 500.

export const devicesRegisterRouter: ReturnType<typeof Router> = Router()

devicesRegisterRouter.post("/", async (_req, res) => {
  await res.status(410).json({
    error: "device_register_removed",
    message:
      "Anonymous device registration is no longer supported. Upgrade the Distro CLI (curl -fsSL https://distrotv.xyz/install.sh | sh) and run `distro init` to sign in with GitHub.",
  })
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
