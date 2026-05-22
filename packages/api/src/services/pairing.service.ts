import { randomBytes } from "node:crypto"
import { getRedis } from "../lib/redis.js"

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

// single-use consume — used by pair-poll once the entry is ready.
export async function consumePairIfReady(
  code: string
): Promise<Extract<PairStatus, { kind: "ready" }> | null> {
  const current = await peekPair(code)
  if (!current || current.kind !== "ready") return null
  await getRedis().del(`${PAIR_PREFIX}${code}`)
  return current
}
