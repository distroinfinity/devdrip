import { randomBytes } from "node:crypto"
import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

export const CONFIG_VERSION = 1

export interface DevdripConfig {
  version: number
  apiUrl: string
  auth: {
    accessToken: string
    refreshToken: string
    accessTokenExpiresAt: string
  }
  user: {
    id: string
    githubLogin: string
    email: string
    avatarUrl: string | null
  }
}

export function configDir(): string {
  return join(homedir(), ".devdrip")
}

export function configPath(): string {
  return join(configDir(), "config.json")
}

export async function readConfig(): Promise<DevdripConfig | null> {
  try {
    const raw = await readFile(configPath(), "utf8")
    const parsed = JSON.parse(raw) as DevdripConfig
    if (parsed.version !== CONFIG_VERSION) return null
    return parsed
  } catch (err) {
    if (isNotFound(err)) return null
    throw err
  }
}

export async function writeConfig(cfg: DevdripConfig): Promise<void> {
  const dir = configDir()
  const target = configPath()
  const tmp = join(dir, `.config.${randomBytes(6).toString("hex")}.tmp`)

  await mkdir(dir, { recursive: true, mode: 0o700 })
  await writeFile(tmp, JSON.stringify(cfg, null, 2), { mode: 0o600 })
  await chmod(tmp, 0o600)
  await rename(tmp, target)
  // some filesystems preserve source mode on rename; re-chmod to be safe
  await chmod(target, 0o600)
}

export async function deleteConfig(): Promise<boolean> {
  try {
    await rm(configPath(), { force: false })
    return true
  } catch (err) {
    if (isNotFound(err)) return false
    throw err
  }
}

export async function configExists(): Promise<boolean> {
  try {
    await stat(configPath())
    return true
  } catch (err) {
    if (isNotFound(err)) return false
    throw err
  }
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "ENOENT"
  )
}

// effective expiry timestamp from an access-token TTL (default 1h, matches backend)
export function accessTokenExpiresAt(ttlSeconds = 3600, now = Date.now()): string {
  return new Date(now + ttlSeconds * 1000).toISOString()
}
