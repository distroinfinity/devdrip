import { resolveEnv, type EnvBundle } from "@distrotv/shared"

function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`${key} is required`)
  return val
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback
}

// resolved once at import time — DISTRO_ENV (or NODE_ENV fallback) drives
// every URL/email default. explicit overrides via API_URL / WEB_URL /
// MAGIC_LINK_FROM_EMAIL still win for ad-hoc testing.
const bundle: EnvBundle = resolveEnv({
  distroEnv: process.env["DISTRO_ENV"],
  apiUrl: process.env["API_URL"],
  webUrl: process.env["WEB_URL"] ?? process.env["MAGIC_LINK_BASE_URL"],
  magicLinkFromEmail: process.env["MAGIC_LINK_FROM_EMAIL"],
  nodeEnv: process.env["NODE_ENV"],
})

export const env = {
  port: Number(optionalEnv("PORT", "3001")),
  nodeEnv: optionalEnv("NODE_ENV", "development"),
  distroEnv: bundle.env,
  apiUrl: bundle.apiUrl,
  webUrl: bundle.webUrl,
  get dbTarget(): "local" | "neon" {
    const val = optionalEnv("DB_TARGET", "local")
    if (val !== "local" && val !== "neon")
      throw new Error(`DB_TARGET must be "local" or "neon", got "${val}"`)
    return val
  },

  get resendApiKey() {
    const nodeEnv = optionalEnv("NODE_ENV", "development")
    return nodeEnv === "production"
      ? requireEnv("RESEND_API_KEY")
      : optionalEnv("RESEND_API_KEY", "re_dev_placeholder")
  },
  get finnhubApiKey(): string {
    return env.nodeEnv === "production"
      ? requireEnv("FINNHUB_API_KEY")
      : optionalEnv("FINNHUB_API_KEY", "dev_placeholder")
  },
  get magicLinkFromEmail() {
    return bundle.magicLinkFromEmail
  },
  get magicLinkBaseUrl() {
    return bundle.webUrl
  },
  get jwtSecret() {
    return requireEnv("JWT_SECRET")
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
  get allowedOrigins(): string[] {
    const origins = requireEnv("ALLOWED_ORIGINS")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean)
    if (origins.length === 0) throw new Error("ALLOWED_ORIGINS must contain at least one origin")
    return origins
  },
}

// M7 will add ADMIN_EMAILS, POSTHOG_API_KEY, SLACK_WEBHOOK_URL.

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
