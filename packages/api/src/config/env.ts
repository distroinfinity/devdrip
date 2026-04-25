function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`${key} is required`)
  return val
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback
}

export const env = {
  port: Number(optionalEnv("PORT", "3001")),
  nodeEnv: optionalEnv("NODE_ENV", "development"),
  get dbTarget(): "local" | "neon" {
    const val = optionalEnv("DB_TARGET", "local")
    if (val !== "local" && val !== "neon")
      throw new Error(`DB_TARGET must be "local" or "neon", got "${val}"`)
    return val
  },

  // lazy — only throws when auth routes are hit, not at startup
  get githubClientId() {
    return requireEnv("GITHUB_CLIENT_ID")
  },
  get githubClientSecret() {
    return requireEnv("GITHUB_CLIENT_SECRET")
  },
  get githubCallbackUrl() {
    return requireEnv("GITHUB_CALLBACK_URL")
  },
  get jwtSecret() {
    return requireEnv("JWT_SECRET")
  },
  get clientRedirectUrl() {
    return requireEnv("CLIENT_REDIRECT_URL")
  },
  get upstashRedisRestUrl() {
    return requireEnv("UPSTASH_REDIS_REST_URL")
  },
  get upstashRedisRestToken() {
    return requireEnv("UPSTASH_REDIS_REST_TOKEN")
  },
  get adminSecret() {
    return requireEnv("ADMIN_SECRET")
  },
  // carbon ads — empty zone key means carbon is disabled
  get carbonZoneKey() {
    return optionalEnv("CARBON_ZONE_KEY", "")
  },
  get carbonPlacement() {
    return optionalEnv("CARBON_PLACEMENT", "devdrip")
  },
  get carbonCpmRate() {
    const raw = optionalEnv("CARBON_CPM_RATE", "0.80")
    const val = Number(raw)
    if (!Number.isFinite(val) || val <= 0) {
      throw new Error(`CARBON_CPM_RATE must be a positive number, got "${raw}"`)
    }
    return val
  },

  get allowedOrigins(): string[] {
    const origins = requireEnv("ALLOWED_ORIGINS")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean)
    if (origins.length === 0) throw new Error("ALLOWED_ORIGINS must contain at least one origin")
    return origins
  },
}

/**
 * Refuses to boot if we'd be pointing a dev process at the deployed Neon DB.
 * Escape hatch: DEVDRIP_ALLOW_NEON_IN_DEV=1 for deliberate integration testing
 * against Neon from a dev machine.
 */
export function assertEnvSafe(): void {
  if (env.nodeEnv !== "development") return
  if (env.dbTarget !== "neon") return
  if (process.env["DEVDRIP_ALLOW_NEON_IN_DEV"] === "1") return

  throw new Error(
    "refusing to start: NODE_ENV=development with DB_TARGET=neon. " +
      "switch to local (set DB_TARGET=local and run `docker compose up -d postgres` " +
      "from the repo root), or, to deliberately test against neon, re-run with " +
      "DEVDRIP_ALLOW_NEON_IN_DEV=1"
  )
}
