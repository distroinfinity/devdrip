import { randomBytes } from "node:crypto"
import { getRedis } from "../lib/redis.js"
import { getDb } from "../db/index.js"
import { devices } from "../db/schema/devices.js"
import { generateDeviceSecret, hashSecret } from "../lib/secret-hash.js"
import { logger } from "../lib/logger.js"

export const PAIR_TTL_SECONDS = 10 * 60
const PAIR_PREFIX = "pair:"

// State machine: pending → ready → consumed (via del).
// Created at /devices/pair-init with no payload. Filled in at /auth/github/complete.
// Consumed once via consumePairIfReady at /devices/pair-poll.

export type PairStatus =
  | { kind: "pending"; createdAt: number }
  | {
      kind: "ready"
      deviceId: string
      userId: string
      deviceToken: string
      createdAt: number
    }

export async function createPendingPair(): Promise<string> {
  const code = randomBytes(16).toString("hex")
  const payload: PairStatus = { kind: "pending", createdAt: Date.now() }
  await getRedis().set(`${PAIR_PREFIX}${code}`, payload, { ex: PAIR_TTL_SECONDS })
  return code
}

// peek without consuming — used by pair-poll to check current state.
export async function peekPair(code: string): Promise<PairStatus | null> {
  return await getRedis().get<PairStatus>(`${PAIR_PREFIX}${code}`)
}

// mark pair as ready with device + user info. called from /auth/github/complete.
export async function markPairReady(input: {
  code: string
  deviceId: string
  userId: string
  deviceToken: string
}): Promise<void> {
  const payload: PairStatus = {
    kind: "ready",
    deviceId: input.deviceId,
    userId: input.userId,
    deviceToken: input.deviceToken,
    createdAt: Date.now(),
  }
  await getRedis().set(`${PAIR_PREFIX}${input.code}`, payload, { ex: PAIR_TTL_SECONDS })
}

// create a device for `userId` and mark the pair ready so the CLI long-poll
// completes. shared by /auth/github/complete (fresh OAuth) and the already-
// signed-in dashboard path (/auth/internal/pair-bind). returns false if the
// pair expired before we got here.
export async function bindPairToUser(userId: string, pairCode: string): Promise<boolean> {
  const current = await peekPair(pairCode)
  if (!current) {
    logger.info({ pairCode }, "pair expired before bind")
    return false
  }
  const deviceSecret = generateDeviceSecret()
  const deviceSecretHash = hashSecret(deviceSecret)
  const [device] = await getDb()
    .insert(devices)
    .values({
      userId,
      machineIdHash: deviceSecretHash.slice(0, 64),
      deviceName: null,
      os: "unknown",
      ideType: "terminal",
      deviceSecretHash,
      lastHeartbeat: new Date(),
    })
    .returning()
  if (!device) throw new Error("device_create_failed")
  await markPairReady({
    code: pairCode,
    deviceId: device.id,
    userId,
    deviceToken: `device.${deviceSecret}`,
  })
  return true
}

// single-use consume — used by pair-poll once the entry is ready.
export async function consumePairIfReady(
  code: string
): Promise<Extract<PairStatus, { kind: "ready" }> | null> {
  const current = await peekPair(code)
  if (!current || current.kind !== "ready") return null
  await getRedis().del(`${PAIR_PREFIX}${code}`)
  return current
}
