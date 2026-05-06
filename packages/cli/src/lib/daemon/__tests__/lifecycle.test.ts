import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createServer, type Server } from "node:net"

let tempHome = ""
let devdripDir = ""

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "devdrip-lifecycle-"))
  process.env["HOME"] = tempHome
  devdripDir = join(tempHome, ".distro")
  mkdirSync(devdripDir, { recursive: true, mode: 0o700 })
})

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true })
})

describe("acquireSingletonLock", () => {
  it("acquires a fresh lock file with our pid", async () => {
    const { acquireSingletonLock } = await import("../lifecycle.js")
    const h = acquireSingletonLock()
    expect(h).not.toBeNull()
    expect(existsSync(join(devdripDir, "daemon.lock"))).toBe(true)
    const pid = parseInt(readFileSync(join(devdripDir, "daemon.lock"), "utf8"), 10)
    expect(pid).toBe(process.pid)
    if (h) h.release()
    expect(existsSync(join(devdripDir, "daemon.lock"))).toBe(false)
  })

  it("refuses when a live pid holds the lock", async () => {
    // parent of ourselves is assumed to be live
    writeFileSync(join(devdripDir, "daemon.lock"), String(process.ppid), { mode: 0o600 })
    const { acquireSingletonLock } = await import("../lifecycle.js")
    expect(acquireSingletonLock()).toBeNull()
  })

  it("replaces a stale lock (pid not alive)", async () => {
    writeFileSync(join(devdripDir, "daemon.lock"), "999999999", { mode: 0o600 })
    const { acquireSingletonLock } = await import("../lifecycle.js")
    const h = acquireSingletonLock()
    expect(h).not.toBeNull()
    const pid = parseInt(readFileSync(join(devdripDir, "daemon.lock"), "utf8"), 10)
    expect(pid).toBe(process.pid)
    if (h) h.release()
  })
})

describe("heartbeat I/O", () => {
  it("writes and reads a heartbeat via atomic tmp+rename", async () => {
    const { writeHeartbeat, readHeartbeat } = await import("../lifecycle.js")
    writeHeartbeat({
      version: 1,
      pid: 42,
      startedAt: 100,
      lastHeartbeat: 200,
      socketPath: "/tmp/x.sock",
      adsShownThisSession: 0,
      hooksReceivedThisSession: 0,
    })
    const got = readHeartbeat()
    expect(got).toMatchObject({ pid: 42, socketPath: "/tmp/x.sock" })
    // no temp file lingers
    const tmps = readdirSync(devdripDir).filter((n) => n.startsWith(".daemon.heartbeat."))
    expect(tmps).toHaveLength(0)
  })

  it("readHeartbeat returns null when the file is absent", async () => {
    const { readHeartbeat } = await import("../lifecycle.js")
    expect(readHeartbeat()).toBeNull()
  })

  it("heartbeat file is mode 0600", async () => {
    const { writeHeartbeat } = await import("../lifecycle.js")
    writeHeartbeat({
      version: 1,
      pid: 1,
      startedAt: 1,
      lastHeartbeat: 1,
      socketPath: "/x",
      adsShownThisSession: 0,
      hooksReceivedThisSession: 0,
    })
    const mode = statSync(join(devdripDir, "daemon.heartbeat")).mode & 0o777
    expect(mode).toBe(0o600)
  })
})

describe("appendLog", () => {
  it("appends lines with ISO timestamps + level + message", async () => {
    const { appendLog } = await import("../lifecycle.js")
    appendLog("info", "hello", { pid: 42 })
    appendLog("warn", "watch", { err: "x" })
    const content = readFileSync(join(devdripDir, "daemon.log"), "utf8")
    const lines = content.trim().split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}T.+Z info {2}hello pid=42$/)
    expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2}T.+Z warn {2}watch err=x$/)
  })
})

describe("isSocketAlive", () => {
  let server: Server | null = null
  let sockPath = ""

  afterEach(async () => {
    const s = server
    if (s) {
      await new Promise<void>((r) => s.close(() => r()))
    }
    server = null
  })

  it("true when a server is listening", async () => {
    sockPath = join(tempHome, "live.sock")
    server = createServer(() => {})
    const s = server
    await new Promise<void>((r) => {
      if (s) s.listen(sockPath, () => r())
    })
    const { isSocketAlive } = await import("../lifecycle.js")
    expect(await isSocketAlive(sockPath)).toBe(true)
  })

  it("false when the socket file doesn't exist", async () => {
    const { isSocketAlive } = await import("../lifecycle.js")
    expect(await isSocketAlive(join(tempHome, "missing.sock"))).toBe(false)
  })
})

describe("resolveSocketPath", () => {
  it("returns ~/.distro/daemon.sock under normal paths", async () => {
    const { resolveSocketPath } = await import("../lifecycle.js")
    const p = resolveSocketPath()
    expect(p).toBe(join(tempHome, ".distro", "daemon.sock"))
  })
})
