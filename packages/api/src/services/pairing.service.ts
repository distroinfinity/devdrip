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

export async function createPairingCode(input: {
  deviceId: string
  userId: string
}): Promise<string> {
  const code = randomBytes(16).toString("hex")
  await getRedis().set(
    `${PAIR_PREFIX}${code}`,
    JSON.stringify({ deviceId: input.deviceId, userId: input.userId, createdAt: Date.now() }),
    { ex: PAIR_TTL_SECONDS }
  )
  return code
}

export interface PairingExchange {
  deviceId: string
  userId: string
}

export async function exchangePairingCode(code: string): Promise<PairingExchange | null> {
  const raw = await getRedis().getdel<string>(`${PAIR_PREFIX}${code}`)
  if (!raw) return null
  let parsed: PairingExchange
  try {
    parsed = JSON.parse(raw) as PairingExchange
  } catch {
    return null
  }
  // store longer-lived "remember" entry for magic-link verify
  await getRedis().set(`${REMEMBER_PREFIX}${code}`, JSON.stringify(parsed), {
    ex: REMEMBER_TTL_SECONDS,
  })
  return parsed
}

export async function exchangePairingCodeForDeviceId(code: string): Promise<string | null> {
  const raw = await getRedis().get<string>(`${REMEMBER_PREFIX}${code}`)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PairingExchange
    return parsed.deviceId
  } catch {
    return null
  }
}
