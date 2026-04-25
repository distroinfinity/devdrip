import { randomBytes } from "node:crypto"

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function generateReferralCode(): string {
  const bytes = randomBytes(8)
  return Array.from(bytes)
    .map((b) => ALPHABET.charAt(b % ALPHABET.length))
    .join("")
}
