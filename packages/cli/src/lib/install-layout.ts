import { randomBytes } from "node:crypto"
import {
  mkdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { basename, join } from "node:path"
import { homedir } from "node:os"

export function distrotvHome(): string {
  return process.env["DISTROTV_HOME"] ?? join(homedir(), ".distrotv")
}
export function versionsDir(): string {
  return join(distrotvHome(), "versions")
}
export function currentLink(): string {
  return join(distrotvHome(), "current")
}
export function versionDir(v: string): string {
  return join(versionsDir(), v)
}
// stable path shims + hooks invoke; resolves through `current` on every call.
export function currentEntryPath(): string {
  return join(currentLink(), "dist", "index.js")
}
export function updateStatePath(): string {
  return join(distrotvHome(), "update-state.json")
}
export function badVersionsPath(): string {
  return join(distrotvHome(), "bad-versions.json")
}

export function readActiveVersion(): string | null {
  try {
    return basename(readlinkSync(currentLink()))
  } catch {
    return null
  }
}

export type UpdatePhase = "probation" | "stable" | "rolled-back"
export interface UpdateState {
  phase: UpdatePhase
  previousVersion: string | null
  newVersion: string
  swappedAt: number
}

export function readUpdateState(): UpdateState | null {
  try {
    return JSON.parse(readFileSync(updateStatePath(), "utf8")) as UpdateState
  } catch {
    return null
  }
}
export function writeUpdateState(s: UpdateState): void {
  atomicWrite(updateStatePath(), JSON.stringify(s, null, 2))
}

export function atomicWrite(target: string, contents: string): void {
  mkdirSync(distrotvHome(), { recursive: true, mode: 0o700 })
  const tmp = join(distrotvHome(), `.${basename(target)}.${randomBytes(6).toString("hex")}.tmp`)
  writeFileSync(tmp, contents, { mode: 0o600 })
  renameSync(tmp, target)
}

// write a temp symlink then rename over `current` — rename is atomic on POSIX.
export function swapCurrent(version: string): void {
  mkdirSync(distrotvHome(), { recursive: true, mode: 0o700 })
  const tmp = join(distrotvHome(), `.current.${randomBytes(6).toString("hex")}`)
  symlinkSync(versionDir(version), tmp)
  renameSync(tmp, currentLink())
}
export function tryUnlink(p: string): void {
  try {
    unlinkSync(p)
  } catch {
    /* ignore */
  }
}
