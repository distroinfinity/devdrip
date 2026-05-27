import {
  createWriteStream,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs"
import { join } from "node:path"
import { spawn } from "node:child_process"
import { pipeline } from "node:stream/promises"
import { Readable } from "node:stream"
import * as tar from "tar"
import {
  atomicWrite,
  badVersionsPath,
  readActiveVersion,
  readUpdateState,
  swapCurrent,
  versionDir,
  versionsDir,
  writeUpdateState,
} from "./install-layout.js"

// ── shared types ────────────────────────────────────────────────────────────

export interface ExecResult {
  code: number
  stdout: string
}
export type ExecFn = (node: string, args: string[]) => Promise<ExecResult>

const defaultExec: ExecFn = (node, args) =>
  new Promise((resolve) => {
    const child = spawn(node, args, { stdio: ["ignore", "pipe", "ignore"] })
    let out = ""
    child.stdout.on("data", (d: Buffer) => (out += d.toString()))
    child.on("error", () => resolve({ code: 127, stdout: "" }))
    child.on("close", (code) => resolve({ code: code ?? 1, stdout: out }))
  })

export interface AutoUpdateDeps {
  exec?: ExecFn
}

// Gate before activation: the staged build must report the expected version AND
// pass `daemon self-check` (loads native deps + opens ledger). Both must pass.
export async function verifyStaged(
  stagedDir: string,
  expectedVersion: string,
  deps: AutoUpdateDeps = {}
): Promise<boolean> {
  const exec = deps.exec ?? defaultExec
  const entry = join(stagedDir, "dist", "index.js")
  const v = await exec(process.execPath, [entry, "--version"])
  if (v.code !== 0 || v.stdout.trim() !== expectedVersion) return false
  const sc = await exec(process.execPath, [entry, "daemon", "self-check"])
  return sc.code === 0
}

// ── Task 7: pipeline ─────────────────────────────────────────────────────────

export const TARBALL_URL =
  "https://github.com/distroinfinity/devdrip/releases/latest/download/distrotv-cli.tar.gz"
export const KEEP_VERSIONS = 1
export const BAD_VERSION_BACKOFF_MS = 60 * 60_000

// Download + extract into a staging dir under versions/.
// Returns the staged dir. Throws on any failure (caller aborts; current untouched).
export async function downloadAndStage(
  url: string,
  version: string,
  deps: AutoUpdateDeps & { fetchImpl?: typeof fetch } = {}
): Promise<string> {
  const fetchImpl = deps.fetchImpl ?? fetch
  mkdirSync(versionsDir(), { recursive: true, mode: 0o700 })
  const staged = join(versionsDir(), `.staging-${version}-${Date.now()}`)
  mkdirSync(staged, { recursive: true })
  const res = await fetchImpl(url)
  if (!res.ok || !res.body) throw new Error(`download failed: ${res.status}`)
  const tgz = join(staged, "cli.tar.gz")
  await pipeline(
    Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
    createWriteStream(tgz)
  )
  await tar.x({ file: tgz, cwd: staged })
  rmSync(tgz, { force: true })
  const exec = deps.exec ?? defaultExec
  const npm = await exec("npm", [
    "install",
    "--omit=dev",
    "--no-audit",
    "--no-fund",
    "--prefix",
    staged,
  ])
  if (npm.code !== 0) throw new Error("npm install failed in staging")
  return staged
}

export function activate(stagedDir: string, version: string, now: () => number = Date.now): void {
  const previous = readActiveVersion()
  renameSync(stagedDir, versionDir(version))
  swapCurrent(version)
  writeUpdateState({
    phase: "probation",
    previousVersion: previous,
    newVersion: version,
    swappedAt: now(),
  })
}

export function rollback(): void {
  const st = readUpdateState()
  if (!st || !st.previousVersion) return
  swapCurrent(st.previousVersion)
  markVersionBad(st.newVersion)
  writeUpdateState({ ...st, phase: "rolled-back" })
}

export function pruneOldVersions(keep = KEEP_VERSIONS): void {
  const active = readActiveVersion()
  const st = readUpdateState()
  const protectedV = new Set([active, st?.previousVersion].filter(Boolean) as string[])
  let dirs: string[]
  try {
    dirs = readdirSync(versionsDir()).filter((d) => !d.startsWith("."))
  } catch {
    return
  }
  const removable = dirs.filter((d) => !protectedV.has(d)).sort()
  const toRemove = removable.slice(0, Math.max(0, removable.length - keep))
  for (const d of toRemove) rmSync(versionDir(d), { recursive: true, force: true })
}

// ── bad-version backoff ───────────────────────────────────────────────────────

interface BadVersions {
  [v: string]: number
}

function readBad(): BadVersions {
  try {
    return JSON.parse(readFileSync(badVersionsPath(), "utf8")) as BadVersions
  } catch {
    return {}
  }
}

export function markVersionBad(v: string): void {
  const b = readBad()
  b[v] = Date.now()
  atomicWrite(badVersionsPath(), JSON.stringify(b))
}

export function isVersionBad(v: string, now = Date.now()): boolean {
  const ts = readBad()[v]
  return ts !== undefined && now - ts < BAD_VERSION_BACKOFF_MS
}
