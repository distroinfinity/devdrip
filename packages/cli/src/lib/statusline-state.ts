import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { configDir } from "./config.js"

// The daemon publishes the current slot here; `distro statusline` reads it and
// Claude Code renders it at the bottom. A staleness TTL is a safety net: if the
// daemon dies without clearing, the line vanishes instead of sticking forever.
const STALE_MS = 30_000

function statePath(): string {
  return join(configDir(), "now-playing.json")
}

export function writeStatusLine(line: string): void {
  try {
    mkdirSync(configDir(), { recursive: true, mode: 0o700 })
    writeFileSync(statePath(), JSON.stringify({ line, ts: Date.now() }), { mode: 0o600 })
  } catch {
    /* never throw from the render path */
  }
}

export function clearStatusLine(): void {
  try {
    unlinkSync(statePath())
  } catch {
    /* already gone */
  }
}

// Read the current line, or "" when nothing is playing / the entry is stale.
export function readStatusLine(): string {
  try {
    const raw = readFileSync(statePath(), "utf8")
    const parsed = JSON.parse(raw) as { line?: unknown; ts?: unknown }
    if (typeof parsed.line !== "string" || typeof parsed.ts !== "number") return ""
    if (Date.now() - parsed.ts > STALE_MS) return ""
    return parsed.line
  } catch {
    return ""
  }
}
