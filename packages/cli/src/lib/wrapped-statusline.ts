import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs"
import { randomBytes } from "node:crypto"
import { join } from "node:path"
import { configDir } from "./config.js"

// When Distro takes over Claude Code's (single-slot) statusLine, we stash the
// user's pre-existing command here so `distro statusline` can run it and append
// our line BELOW its output — and so uninstall can restore it. Lives in our own
// config dir, never inside Claude's settings.json.

export interface WrappedStatusLine {
  type?: string
  command: string
  padding?: number
}

function wrappedPath(): string {
  return join(configDir(), "wrapped-statusline.json")
}

export function readWrappedStatusLine(): WrappedStatusLine | null {
  try {
    const parsed = JSON.parse(readFileSync(wrappedPath(), "utf8")) as WrappedStatusLine
    if (!parsed || typeof parsed.command !== "string" || parsed.command.length === 0) return null
    return parsed
  } catch {
    return null
  }
}

export function writeWrappedStatusLine(entry: WrappedStatusLine): void {
  try {
    const dir = configDir()
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    const tmp = join(dir, `.wrapped-statusline.${randomBytes(6).toString("hex")}.tmp`)
    writeFileSync(tmp, JSON.stringify(entry, null, 2), { mode: 0o600 })
    renameSync(tmp, wrappedPath())
  } catch {
    /* non-fatal */
  }
}

export function clearWrappedStatusLine(): void {
  try {
    unlinkSync(wrappedPath())
  } catch {
    /* already gone */
  }
}

export function hasWrappedStatusLine(): boolean {
  return readWrappedStatusLine() !== null
}
