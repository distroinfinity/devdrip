import { randomBytes } from "node:crypto"
import { count, desc, isNull } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { inviteCodes } from "../db/schema/invite_codes.js"
import { pgErrorCode } from "../errors/index.js"

// 10-char base32 code — ~50 bits of entropy, fits varchar(20), readable enough
// for operators to paste around. Excludes lookalike chars (0/O, 1/I/L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

function generateCode(): string {
  const bytes = randomBytes(10)
  let out = ""
  for (let i = 0; i < 10; i++) {
    const byte = bytes[i] ?? 0
    out += ALPHABET[byte % ALPHABET.length]
  }
  return out
}

export async function generateBatch(count: number) {
  const db = getDb()
  // retry only on unique-violation (23505). any other pg error throws immediately
  // so real DB failures aren't masked as "exhausted retries".
  let lastCollisionErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    const values = Array.from({ length: count }, () => ({ code: generateCode() }))
    try {
      return await db.insert(inviteCodes).values(values).returning()
    } catch (err) {
      if (pgErrorCode(err) !== "23505") throw err
      lastCollisionErr = err
    }
  }
  // preserve the original pg error so callers can see it was a collision storm,
  // not some other opaque failure
  throw lastCollisionErr ?? new Error("invite_generation_exhausted_retries")
}

export async function listUnused(limit: number, offset: number) {
  const db = getDb()
  const where = isNull(inviteCodes.usedAt)
  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(inviteCodes)
      .where(where)
      .orderBy(desc(inviteCodes.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(inviteCodes).where(where),
  ])
  return { invites: rows, total: totalRow?.count ?? 0 }
}
