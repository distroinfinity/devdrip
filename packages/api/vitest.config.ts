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

export default defineConfig({
  test: {
    environment: "node",
  },
})
