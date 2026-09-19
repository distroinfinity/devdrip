import { eq } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { users } from "../db/schema/users.js"
import { nullifiers } from "../db/schema/nullifiers.js"
import { env } from "../config/env.js"
import { ApiError, ValidationError } from "../errors/index.js"
import { logger } from "../lib/logger.js"

// IDKit response shape — the four fields Cloud verify needs forwarded.
export interface WorldIdProof {
  nullifier_hash: string // 0x-prefixed hex, 256-bit
  merkle_root: string
  proof: string
  verification_level: "device" | "orb"
}

// Convert IDKit's hex nullifier to a decimal string for NUMERIC(78,0) storage.
function hexToDecimalString(hex: string): string {
  const stripped = hex.startsWith("0x") ? hex.slice(2) : hex
  return BigInt("0x" + stripped).toString(10)
}

export interface VerifyWorldIdInput {
  userId: string
  proof: WorldIdProof
}

export async function verifyWorldId(
  input: VerifyWorldIdInput
): Promise<{ verificationLevel: "device" | "orb" }> {
  const action = env.worldIdAction
  const appId = env.worldAppId
  if (!appId) throw new ApiError(500, "world_app_id_not_configured")

  const cloudUrl = `https://developer.world.org/api/v4/verify/${appId}`
  const cloudResp = await fetch(cloudUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nullifier_hash: input.proof.nullifier_hash,
      merkle_root: input.proof.merkle_root,
      proof: input.proof.proof,
      verification_level: input.proof.verification_level,
      action,
    }),
  })

  if (!cloudResp.ok) {
    const body = await cloudResp.text().catch(() => "")
    logger.warn({ status: cloudResp.status, body }, "world id cloud verify rejected")
    throw new ValidationError("world_id_verification_failed")
  }

  const decimalNullifier = hexToDecimalString(input.proof.nullifier_hash)
  const db = getDb()

  // Insert into nullifiers (composite PK on (nullifier, action)) — ON CONFLICT
  // tells us this nullifier was already used for THIS action, which is exactly
  // the anti-replay condition. Wrapped in a transaction so the nullifier insert
  // and the user update commit/rollback together.
  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(nullifiers)
      .values({
        nullifier: decimalNullifier,
        action,
        userId: input.userId,
      })
      .onConflictDoNothing()
      .returning()

    if (inserted.length === 0) {
      throw new ApiError(409, "nullifier_already_used")
    }

    const [updated] = await tx
      .update(users)
      .set({
        nullifierHash: decimalNullifier,
        verificationLevel: input.proof.verification_level,
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.userId))
      .returning()
    if (!updated) throw new Error("user_update_failed_after_world_id")
  })

  return { verificationLevel: input.proof.verification_level }
}
