import { spawn, type ChildProcess } from "node:child_process"
import { randomBytes } from "node:crypto"
import {
  appendFileSync,
  chmodSync,
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { createConnection } from "node:net"
import { join } from "node:path"
import { daemonSocketPath } from "@distrotv/shared/daemon-socket"
import { configDir } from "../config.js"
import type { UpdateState } from "../install-layout.js"
import { readUpdateState } from "../install-layout.js"

// ── paths ───────────────────────────────────────────────────────────────

export function lockPath(): string {
  return join(configDir(), "daemon.lock")
}

export function heartbeatPath(): string {
  return join(configDir(), "daemon.heartbeat")
}

export function logPath(): string {
  return join(configDir(), "daemon.log")
}

export function resolveSocketPath(): string {
  return daemonSocketPath()
}

function ensureConfigDir(): void {
  mkdirSync(configDir(), { recursive: true, mode: 0o700 })
}

// ── singleton lock ──────────────────────────────────────────────────────

export interface LockHandle {
  release(): void
}

/** Returns null if another live process holds the lock. */
export function acquireSingletonLock(): LockHandle | null {
  ensureConfigDir()
  const path = lockPath()
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(path, "wx", 0o600)
      writeFileSync(fd, String(process.pid))
      closeSync(fd)
      return { release: () => tryUnlink(path) }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err
    }

    // existing lock — is it held by a live pid?
    let pid: number
    try {
      pid = parseInt(readFileSync(path, "utf8").trim(), 10)
    } catch {
      tryUnlink(path)
      continue
    }
    if (Number.isFinite(pid) && isProcessAlive(pid)) return null
    tryUnlink(path)
  }
  return null
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === "ESRCH") return false
    if (code === "EPERM") return true // exists, we just can't signal
    return false
  }
}

function tryUnlink(path: string): void {
  try {
    unlinkSync(path)
  } catch {
    /* ignore */
  }
}

export function removeLockFile(): void {
  tryUnlink(lockPath())
}

// ── heartbeat ───────────────────────────────────────────────────────────

export interface Heartbeat {
  version: 1
  pid: number
  startedAt: number
  lastHeartbeat: number
  socketPath: string
  adsShownThisSession: number
  hooksReceivedThisSession: number
}

export function writeHeartbeat(hb: Heartbeat): void {
  ensureConfigDir()
  const target = heartbeatPath()
  const tmp = join(configDir(), `.daemon.heartbeat.${randomBytes(6).toString("hex")}.tmp`)
  writeFileSync(tmp, JSON.stringify(hb, null, 2), { mode: 0o600 })
  renameSync(tmp, target)
  try {
    chmodSync(target, 0o600)
  } catch {
    /* ignore */
  }
}

export function readHeartbeat(): Heartbeat | null {
  try {
    const raw = readFileSync(heartbeatPath(), "utf8")
    return JSON.parse(raw) as Heartbeat
  } catch {
    return null
  }
}

export function removeHeartbeat(): void {
  tryUnlink(heartbeatPath())
}

// ── daemon spawn + respawn debounce ───────────────────────────────────────

// detached spawn only — returns immediately, never waits for readiness, and
// swallows spawn errors so a caller like the hook path can never be crashed by
// an unexecutable binPath. the singleton lock keeps duplicate daemons from
// living, so this is safe to call from concurrent hooks.
export function spawnDaemonDetached(binPath: string): ChildProcess {
  ensureConfigDir()
  const logFd = openSync(logPath(), "a", 0o600)
  const child = spawn(binPath, ["daemon", "run"], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: process.env,
  })
  child.on("error", () => {
    /* swallow — must never crash the caller */
  })
  child.unref()
  try {
    closeSync(logFd)
  } catch {
    /* ignore */
  }
  return child
}

export function respawnStampPath(): string {
  return join(configDir(), "daemon.respawn")
}

export const RESPAWN_DEBOUNCE_MS = 5_000

// true iff a hook-driven respawn is allowed right now (no stamp, or the last
// attempt is older than the debounce window). writes a fresh stamp when it
// returns true so concurrent/rapid hooks can't spawn-storm a crash-looping
// daemon. fail-open on any fs error — better to over-spawn once than never heal.
export function tryClaimRespawn(now: number = Date.now()): boolean {
  try {
    const ts = parseInt(readFileSync(respawnStampPath(), "utf8").trim(), 10)
    if (Number.isFinite(ts) && now - ts < RESPAWN_DEBOUNCE_MS) return false
  } catch {
    /* missing/unreadable → allowed */
  }
  try {
    ensureConfigDir()
    const tmp = join(configDir(), `.daemon.respawn.${randomBytes(6).toString("hex")}.tmp`)
    writeFileSync(tmp, String(now), { mode: 0o600 })
    renameSync(tmp, respawnStampPath())
  } catch {
    /* best-effort */
  }
  return true
}

// single source of truth for "is the daemon healthy right now?". consumed by
// both `distro daemon status` and `distro status`, so they can't drift.
export const HEARTBEAT_STALE_AFTER_MS = 30_000

export type DaemonHealth = "running" | "stale" | "not-running"

export interface DaemonStatus {
  health: DaemonHealth
  pid: number | null
  socketPath: string | null
  uptimeMs: number | null
  lastHeartbeatAgeMs: number | null
  adsShownThisSession: number
  hooksReceivedThisSession: number
}

export function readDaemonStatus(now: number = Date.now()): DaemonStatus {
  const hb = readHeartbeat()
  if (!hb) {
    return {
      health: "not-running",
      pid: null,
      socketPath: null,
      uptimeMs: null,
      lastHeartbeatAgeMs: null,
      adsShownThisSession: 0,
      hooksReceivedThisSession: 0,
    }
  }
  const age = now - hb.lastHeartbeat
  const stale = age > HEARTBEAT_STALE_AFTER_MS
  return {
    health: stale ? "stale" : "running",
    pid: hb.pid,
    socketPath: hb.socketPath,
    uptimeMs: stale ? null : now - hb.startedAt,
    lastHeartbeatAgeMs: age,
    adsShownThisSession: hb.adsShownThisSession ?? 0,
    hooksReceivedThisSession: hb.hooksReceivedThisSession ?? 0,
  }
}

// ── log ─────────────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error"

export function appendLog(
  level: LogLevel,
  message: string,
  fields: Record<string, unknown> = {}
): void {
  ensureConfigDir()
  const pairs = Object.entries(fields)
    .map(([k, v]) => `${k}=${formatField(v)}`)
    .join(" ")
  const line = `${new Date().toISOString()} ${level.padEnd(5)} ${message}${
    pairs ? " " + pairs : ""
  }\n`
  try {
    appendFileSync(logPath(), line, { mode: 0o600 })
  } catch {
    /* log writes never throw up the stack */
  }
}

function formatField(v: unknown): string {
  if (v === null || v === undefined) return "null"
  if (typeof v === "string") return v.includes(" ") ? JSON.stringify(v) : v
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return "<unserializable>"
  }
}

// ── probation rollback ───────────────────────────────────────────────────

// wait this long after a swap with no fresh heartbeat before declaring the
// new build a crash-loop and reverting. longer than the daemon's normal boot.
export const PROBATION_FAIL_AFTER_MS = 90_000

// pure: revert iff we're on probation, the previous version is known, the new
// build has produced NO heartbeat since the swap, and enough time has elapsed.
export function shouldRollbackOnRespawn(args: {
  state: UpdateState | null
  lastHeartbeatAt: number | null
  now: number
}): boolean {
  const { state, lastHeartbeatAt, now } = args
  if (!state || state.phase !== "probation" || !state.previousVersion) return false
  const healthySinceSwap = lastHeartbeatAt !== null && lastHeartbeatAt >= state.swappedAt
  if (healthySinceSwap) return false
  return now - state.swappedAt >= PROBATION_FAIL_AFTER_MS
}

// called from the respawn decision. fs-only + pure decision; only when a
// rollback is actually warranted do we dynamically import the (heavier)
// auto-update module to perform it. returns true if it rolled back.
export async function preflightRollbackIfStuck(now: number = Date.now()): Promise<boolean> {
  const state = readUpdateState()
  const hb = readHeartbeat()
  if (!shouldRollbackOnRespawn({ state, lastHeartbeatAt: hb?.lastHeartbeat ?? null, now })) {
    return false
  }
  const { rollback } = await import("../auto-update.js")
  rollback()
  appendLog("warn", "auto-update probation failed — rolled back", {
    newVersion: state?.newVersion,
  })
  return true
}

// ── socket probe ────────────────────────────────────────────────────────

export function isSocketAlive(path: string, timeoutMs = 100): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      statSync(path)
    } catch {
      resolve(false)
      return
    }
    const sock = createConnection(path)
    sock.setTimeout(timeoutMs)
    let settled = false
    const done = (alive: boolean) => {
      if (settled) return
      settled = true
      sock.destroy()
      resolve(alive)
    }
    sock.on("connect", () => done(true))
    sock.on("error", () => done(false))
    sock.on("timeout", () => done(false))
  })
}

export function unlinkSocketIfExists(path: string): void {
  tryUnlink(path)
}
