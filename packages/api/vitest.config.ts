import { defineConfig } from "vitest/config"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

// load .env.test if it exists (local dev), CI sets env vars directly
const envTestPath = resolve(import.meta.dirname, ".env.test")
if (existsSync(envTestPath)) {
  for (const line of readFileSync(envTestPath, "utf-8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx)
    const val = trimmed.slice(eqIdx + 1)
    process.env[key] ??= val
  }
}

process.env["NODE_ENV"] ??= "test"
process.env["ALLOWED_ORIGINS"] ??= "http://localhost:3000,http://localhost:3002"
process.env["JWT_SECRET"] ??=
  "vitest-secret-000000000000000000000000000000000000000000000000000000000000"
process.env["ADMIN_SECRET"] ??= "vitest-admin-secret"
process.env["CLIENT_REDIRECT_URL"] ??= "http://localhost:3000/auth/debug"
process.env["GITHUB_CLIENT_ID"] ??= "vitest-github-client-id"
process.env["GITHUB_CLIENT_SECRET"] ??= "vitest-github-client-secret"
process.env["GITHUB_CALLBACK_URL"] ??= "http://localhost:3001/auth/github/callback"

export default defineConfig({
  test: {
    environment: "node",
  },
})
