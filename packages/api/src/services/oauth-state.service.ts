import { createHash, randomBytes } from "node:crypto"
import { getRedis } from "../lib/redis.js"

const STATE_TTL_SECONDS = 10 * 60
const STATE_PREFIX = "oauth-state:"

export interface OAuthStatePayload {
  pairCode?: string
  next?: string
  createdAt: number
}

// double-submit CSRF: cookie holds N, redis is keyed by sha256(N).
// Returns the raw nonce — caller puts it in both the cookie and the github `state` param.
export async function createOAuthState(input: {
  pairCode?: string
  next?: string
}): Promise<string> {
  const nonce = randomBytes(24).toString("hex")
  const hash = sha256(nonce)
  const payload: OAuthStatePayload = {
    pairCode: input.pairCode,
    next: input.next,
    createdAt: Date.now(),
  }
  await getRedis().set(`${STATE_PREFIX}${hash}`, payload, { ex: STATE_TTL_SECONDS })
  return nonce
}

// single-use: getdel guarantees one consumer. Returns null on missing/expired.
export async function consumeOAuthState(nonce: string): Promise<OAuthStatePayload | null> {
  const hash = sha256(nonce)
  return await getRedis().getdel<OAuthStatePayload>(`${STATE_PREFIX}${hash}`)
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex")
}
