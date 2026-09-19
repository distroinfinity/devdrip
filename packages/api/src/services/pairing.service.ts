import { randomBytes } from "node:crypto"
import { getRedis } from "../lib/redis.js"

export const PAIR_TTL_SECONDS = 10 * 60
const REMEMBER_TTL_SECONDS = 30 * 60
const PAIR_PREFIX = "pair:"
const REMEMBER_PREFIX = "pair-remember:"

// pairing flow:
// 1. CLI calls POST /devices/pair (device bearer auth) → returns { code }
// 2. CLI opens browser at /setup?pair=<code>
// 3. browser POSTs /auth/exchange-pair { code } → returns 7-day session JWT
// 4. exchangePairingCode also writes a "pair-remember" key (30 min TTL) so a
//    subsequent magic-link verify can re-point that device to the email user
//
// upstash auto-serializes objects on set + auto-deserializes on get/getdel —
// pass payloads as objects, never as JSON.stringify'd strings (would double-encode).

export interface PairingExchange {
  deviceId: string
  userId: string
  createdAt: number
}

export async function createPairingCode(input: {
  deviceId: string
  userId: string
}): Promise<string> {
  const code = randomBytes(16).toString("hex")
  const payload: PairingExchange = {
    deviceId: input.deviceId,
    userId: input.userId,
    createdAt: Date.now(),
  }
  await getRedis().set(`${PAIR_PREFIX}${code}`, payload, { ex: PAIR_TTL_SECONDS })
  return code
}

export async function exchangePairingCode(code: string): Promise<PairingExchange | null> {
  const payload = await getRedis().getdel<PairingExchange>(`${PAIR_PREFIX}${code}`)
  if (!payload) return null
  // store longer-lived "remember" entry for magic-link verify
  await getRedis().set(`${REMEMBER_PREFIX}${code}`, payload, { ex: REMEMBER_TTL_SECONDS })
  return payload
}

export async function exchangePairingCodeForDeviceId(code: string): Promise<string | null> {
  const payload = await getRedis().get<PairingExchange>(`${REMEMBER_PREFIX}${code}`)
  return payload?.deviceId ?? null
}
