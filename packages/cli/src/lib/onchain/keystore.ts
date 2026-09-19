import { writeFileSync, readFileSync, existsSync, mkdirSync, chmodSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

const DIR = join(homedir(), ".distro")
const KEY_PATH = join(DIR, "onchain-key.json")

export function hasKey(): boolean {
  return existsSync(KEY_PATH)
}

export function loadAccount() {
  const { privateKey } = JSON.parse(readFileSync(KEY_PATH, "utf8")) as { privateKey: `0x${string}` }
  return privateKeyToAccount(privateKey)
}

export function createKey(imported?: `0x${string}`): string {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
  const privateKey = imported ?? generatePrivateKey()
  writeFileSync(KEY_PATH, JSON.stringify({ privateKey }), { mode: 0o600 })
  chmodSync(KEY_PATH, 0o600)
  return privateKeyToAccount(privateKey).address
}
