import { randomInt } from "node:crypto"

// Crockford's base32 alphabet — 32 chars, excludes I/L/O/U to avoid ambiguity
// with 1/0 and the unfortunate. Used for human-typeable CLI pairing codes
// rendered as QR + printed in the terminal.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

function triplet(): string {
  return Array.from({ length: 3 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")
}

// Returns a code shaped like "K4F-9XQ-7BR" — 9 base32 chars in 3 dash-separated
// triples. ~2.4 trillion possibilities; collision-vanishingly-improbable for
// 5-min-TTL ephemeral pair sessions.
export function generatePairCode(): string {
  return `${triplet()}-${triplet()}-${triplet()}`
}

// Strict format check used by the cli-pair validator and the link route.
const PAIR_CODE_RE = new RegExp(`^[${ALPHABET}]{3}-[${ALPHABET}]{3}-[${ALPHABET}]{3}$`)

export function isValidPairCode(s: string): boolean {
  return PAIR_CODE_RE.test(s)
}
