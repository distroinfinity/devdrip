import { randomBytes } from "node:crypto"
import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { defaultDevdripPreferences, type DevdripPreferences } from "@distrotv/shared"

export const CONFIG_VERSION = 4

export interface DevdripConfig {
  version: 4
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
  device: { id: string | null }
  cli: { binPath: string }
  preferences: DevdripPreferences
}

export function configDir(): string {
  return join(homedir(), ".distro")
}

export function configPath(): string {
  return join(configDir(), "config.json")
}

interface RawConfigV1 {
  version: 1
  apiUrl: string
  auth: DevdripConfig["auth"]
  user: DevdripConfig["user"]
}

interface RawConfigV2 {
  version: 2
  apiUrl: string
  auth: DevdripConfig["auth"]
  user: DevdripConfig["user"]
  device?: DevdripConfig["device"]
  cli?: DevdripConfig["cli"]
}

interface RawConfigV3 {
  version: 3
  apiUrl: string
  auth: DevdripConfig["auth"]
  user: DevdripConfig["user"]
  device?: DevdripConfig["device"]
  cli?: DevdripConfig["cli"]
  preferences?: Partial<DevdripPreferences>
}

export class UnsupportedConfigVersionError extends Error {
  constructor(version: unknown) {
    super(
      `unsupported config version ${String(version)} in ${configPath()} — run \`distro auth --force\` to recreate it`
    )
    this.name = "UnsupportedConfigVersionError"
  }
}

function mergePreferences(saved: Partial<DevdripPreferences> | undefined): DevdripPreferences {
  const defaults = defaultDevdripPreferences()
  if (!saved) return defaults
  return { ...defaults, ...saved }
}

function migrate(parsed: Record<string, unknown>): DevdripConfig {
  const version = parsed["version"]
  if (version === CONFIG_VERSION) {
    const v4 = parsed as unknown as DevdripConfig
    return {
      ...v4,
      device: v4.device ?? { id: null },
      cli: v4.cli ?? { binPath: "" },
      preferences: mergePreferences(v4.preferences),
    }
  }
  if (version === 3) {
    const v3 = parsed as unknown as RawConfigV3
    // mergePreferences fills in channelMode (Mix) and newsTopics ([]) defaults
    // from defaultDevdripPreferences() — no user prompt needed. existing v3
    // users get auto-migrated; they can flip mode via `distro preferences`.
    return {
      version: CONFIG_VERSION,
      apiUrl: v3.apiUrl,
      auth: v3.auth,
      user: v3.user,
      device: v3.device ?? { id: null },
      cli: v3.cli ?? { binPath: "" },
      preferences: mergePreferences(v3.preferences),
    }
  }
  if (version === 2) {
    const v2 = parsed as unknown as RawConfigV2
    return {
      version: CONFIG_VERSION,
      apiUrl: v2.apiUrl,
      auth: v2.auth,
      user: v2.user,
      device: v2.device ?? { id: null },
      cli: v2.cli ?? { binPath: "" },
      preferences: defaultDevdripPreferences(),
    }
  }
  if (version === 1) {
    const v1 = parsed as unknown as RawConfigV1
    return {
      version: CONFIG_VERSION,
      apiUrl: v1.apiUrl,
      auth: v1.auth,
      user: v1.user,
      device: { id: null },
      cli: { binPath: "" },
      preferences: defaultDevdripPreferences(),
    }
  }
  throw new UnsupportedConfigVersionError(version)
}

export async function readConfig(): Promise<DevdripConfig | null> {
  try {
    const raw = await readFile(configPath(), "utf8")
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return migrate(parsed)
  } catch (err) {
    if (isNotFound(err)) return null
    throw err
  }
}

export async function writeConfig(
  cfg: Omit<DevdripConfig, "version" | "preferences"> & {
    preferences?: DevdripPreferences
  }
): Promise<void> {
  const dir = configDir()
  const target = configPath()
  const tmp = join(dir, `.config.${randomBytes(6).toString("hex")}.tmp`)

  await mkdir(dir, { recursive: true, mode: 0o700 })
  const toWrite: DevdripConfig = {
    ...cfg,
    version: CONFIG_VERSION,
    preferences: mergePreferences(cfg.preferences),
  }
  await writeFile(tmp, JSON.stringify(toWrite, null, 2), { mode: 0o600 })
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
