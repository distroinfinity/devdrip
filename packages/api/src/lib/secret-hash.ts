import { createHash, randomBytes } from "node:crypto"

export function generateDeviceSecret(): string {
  return randomBytes(32).toString("hex")
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex")
}
