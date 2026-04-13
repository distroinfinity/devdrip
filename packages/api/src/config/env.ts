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
  dbTarget: optionalEnv("DB_TARGET", "local") as "local" | "neon",

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
}
