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
import { daemonSocketPath } from "@devdrip/shared"
import { configDir } from "../config.js"

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

// ── heartbeat ───────────────────────────────────────────────────────────

export interface Heartbeat {
  version: 1
  pid: number
  startedAt: number
  lastHeartbeat: number
  socketPath: string
  adsShownThisSession: number
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
