import { randomBytes } from "node:crypto"
import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { defaultDevdripPreferences, type DevdripPreferences } from "@distrotv/shared"

export const CONFIG_VERSION = 5

export interface DevdripConfig {
  version: 5
  apiUrl: string
  // null for anon devices; populated post-M2 magic-link sign-in
  auth: {
    accessToken: string
    accessTokenExpiresAt: string
  } | null
  user: {
    id: string
  }
  // secret is present for anon-registered devices; cleared post-M2 if we swap to JWT-only
  device: { id: string | null; secret?: string }
  cli: { binPath: string }
  preferences: DevdripPreferences
}

export function configDir(): string {
  return join(homedir(), ".distro")
}

export function configPath(): string {
  return join(configDir(), "config.json")
}

// legacy v1-v4 auth shape (had refreshToken + full user fields)
interface LegacyAuth {
  accessToken: string
  refreshToken?: string
  accessTokenExpiresAt: string
}

interface LegacyUser {
  id: string
  githubLogin?: string
  email?: string
  avatarUrl?: string | null
}

interface RawConfigV1 {
  version: 1
  apiUrl: string
  auth: LegacyAuth
  user: LegacyUser
}

interface RawConfigV2 {
  version: 2
  apiUrl: string
  auth: LegacyAuth
  user: LegacyUser
  device?: { id: string | null }
  cli?: DevdripConfig["cli"]
}

interface RawConfigV3 {
  version: 3
  apiUrl: string
  auth: LegacyAuth
  user: LegacyUser
  device?: { id: string | null }
  cli?: DevdripConfig["cli"]
  preferences?: Partial<DevdripPreferences>
}

interface RawConfigV4 {
  version: 4
  apiUrl: string
  auth: LegacyAuth
  user: LegacyUser
  device?: { id: string | null }
  cli?: DevdripConfig["cli"]
  preferences?: Partial<DevdripPreferences>
}

export class UnsupportedConfigVersionError extends Error {
  constructor(version: unknown) {
    super(
      `unsupported config version ${String(version)} in ${configPath()} — run \`distro init\` to recreate it`
    )
    this.name = "UnsupportedConfigVersionError"
  }
}

function mergePreferences(saved: Partial<DevdripPreferences> | undefined): DevdripPreferences {
  const defaults = defaultDevdripPreferences()
  if (!saved) return defaults
  return { ...defaults, ...saved }
}

function legacyAuthToV5(auth: LegacyAuth): DevdripConfig["auth"] {
  // keep JWT path alive for M2; strip refreshToken (no longer needed by CLI)
  return { accessToken: auth.accessToken, accessTokenExpiresAt: auth.accessTokenExpiresAt }
}

function migrate(parsed: Record<string, unknown>): DevdripConfig {
  const version = parsed["version"]
  if (version === CONFIG_VERSION) {
    const v5 = parsed as unknown as DevdripConfig
    return {
      ...v5,
      device: v5.device ?? { id: null },
      cli: v5.cli ?? { binPath: "" },
      preferences: mergePreferences(v5.preferences),
    }
  }
  // v1-v4: had full github/email user fields + refreshToken — reset to anon shape.
  // no real users on these versions (pre-launch); safe to drop legacy auth.
  if (version === 4) {
    const v4 = parsed as unknown as RawConfigV4
    return {
      version: CONFIG_VERSION,
      apiUrl: v4.apiUrl,
      auth: v4.auth ? legacyAuthToV5(v4.auth) : null,
      user: { id: v4.user.id },
      device: v4.device ?? { id: null },
      cli: v4.cli ?? { binPath: "" },
      preferences: mergePreferences(v4.preferences),
    }
  }
  if (version === 3) {
    const v3 = parsed as unknown as RawConfigV3
    return {
      version: CONFIG_VERSION,
      apiUrl: v3.apiUrl,
      auth: v3.auth ? legacyAuthToV5(v3.auth) : null,
      user: { id: v3.user.id },
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
      auth: v2.auth ? legacyAuthToV5(v2.auth) : null,
      user: { id: v2.user.id },
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
      auth: v1.auth ? legacyAuthToV5(v1.auth) : null,
      user: { id: v1.user.id },
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
