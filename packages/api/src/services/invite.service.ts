import { randomBytes } from "node:crypto"
import { desc, isNull } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { inviteCodes } from "../db/schema/invite_codes.js"

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
  // retry loop on rare collision (unique index on code)
  for (let attempt = 0; attempt < 3; attempt++) {
    const values = Array.from({ length: count }, () => ({ code: generateCode() }))
    try {
      return await db.insert(inviteCodes).values(values).returning()
    } catch (err) {
      // 23505 = unique violation
      const code = (err as { code?: string; cause?: { code?: string } }).code
      if (code !== "23505" && attempt === 2) throw err
    }
  }
  throw new Error("invite_generation_exhausted_retries")
}

export async function listUnused(limit: number, offset: number) {
  const db = getDb()
  const rows = await db
    .select()
    .from(inviteCodes)
    .where(isNull(inviteCodes.usedAt))
    .orderBy(desc(inviteCodes.createdAt))
    .limit(limit)
    .offset(offset)
  return { invites: rows }
}
