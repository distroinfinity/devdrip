import { randomBytes } from "node:crypto"
import { eq } from "drizzle-orm"
import { verifySiweMessage } from "@worldcoin/minikit-js"
import { getDb } from "../db/index.js"
import { getRedis } from "../lib/redis.js"
import { users } from "../db/schema/users.js"
import { generateReferralCode } from "../lib/referral.js"
import { ValidationError } from "../errors/index.js"

const NONCE_TTL_SECONDS = 5 * 60 // 5 minutes
const NONCE_KEY_PREFIX = "walletauth:nonce:"

export async function mintWalletAuthNonce(): Promise<string> {
  const nonce = randomBytes(16).toString("hex") // 32 hex chars
  await getRedis().set(`${NONCE_KEY_PREFIX}${nonce}`, "1", { ex: NONCE_TTL_SECONDS })
  return nonce
}

// Returns true if the nonce existed and was consumed; false otherwise. We
// `getdel` to enforce single-use atomically.
async function consumeWalletAuthNonce(nonce: string): Promise<boolean> {
  const v = await getRedis().getdel<string>(`${NONCE_KEY_PREFIX}${nonce}`)
  return v !== null
}

export interface WalletAuthVerifyInput {
  payload: Parameters<typeof verifySiweMessage>[0]
  nonce: string
}

export interface WalletAuthVerifyResult {
  userId: string
  walletAddress: string
}

// Verifies the SIWE payload from MiniKit, recovers the address, upserts the
// user row by wallet_address. If the user already exists with this wallet,
// returns the existing user_id (so subsequent visits log the user in instead
// of duplicating). New users get a placeholder email derived from address +
// a fresh referral code.
export async function verifyWalletAuth(
  input: WalletAuthVerifyInput
): Promise<WalletAuthVerifyResult> {
  const consumed = await consumeWalletAuthNonce(input.nonce)
  if (!consumed) throw new ValidationError("nonce_invalid_or_expired")

  const result = await verifySiweMessage(input.payload, input.nonce)
  if (!result.isValid) throw new ValidationError("siwe_verification_failed")

  // verifySiweMessage's siweMessageData includes the address — viem-style 0x...
  const address = result.siweMessageData.address
  if (!address) throw new ValidationError("siwe_verification_failed")
  const recovered = address.toLowerCase()

  const db = getDb()

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.walletAddress, recovered))
    .limit(1)
  if (existing) {
    return { userId: existing.id, walletAddress: recovered }
  }

  const placeholderEmail = `${recovered}@wallet.devdrip.local`
  const [created] = await db
    .insert(users)
    .values({
      email: placeholderEmail,
      walletAddress: recovered,
      referralCode: generateReferralCode(),
    })
    .onConflictDoNothing({ target: users.email })
    .returning()
  if (created) return { userId: created.id, walletAddress: recovered }

  // Race: another concurrent verify already created the user. Re-SELECT.
  const [raced] = await db.select().from(users).where(eq(users.walletAddress, recovered)).limit(1)
  if (raced) return { userId: raced.id, walletAddress: recovered }
  throw new Error("user_creation_failed")
}
