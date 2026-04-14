import { Router } from "express"
import rateLimit from "express-rate-limit"
import { getDb } from "../db/index.js"
import { devices } from "../db/schema/devices.js"

const MACHINE_ID_HASH_RE = /^[0-9a-f]{64}$/
const VALID_OS = ["darwin", "linux", "win32"] as const
const VALID_IDE_TYPES = ["terminal", "vscode", "cursor"] as const

const deviceLimiter = rateLimit({ windowMs: 60_000, limit: 10 })

export const devicesRouter: ReturnType<typeof Router> = Router()

// ── POST /devices ───────────────────────────────────────────────────────────
devicesRouter.post("/", deviceLimiter, async (_req, res) => {
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

  // only update deviceName on re-registration if the caller explicitly provided it
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
    console.error("device registration error:", err)
    await res.status(500).json({ error: "internal_error" })
  }
})
