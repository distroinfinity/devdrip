import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { execFileSync, spawn, type ChildProcess } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createConnection } from "node:net"

let tempHome = ""
let devdripDir = ""
let binPath = ""
let sockPath = ""
let child: ChildProcess | null = null

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "devdrip-e2e-"))
  devdripDir = join(tempHome, ".devdrip")
  mkdirSync(devdripDir, { recursive: true, mode: 0o700 })
  sockPath = join(devdripDir, "daemon.sock")

  // Resolve the built CLI bin (dist) produced by the package build
  binPath = join(__dirname, "..", "..", "..", "dist", "index.js")

  // Write a minimal config so daemon run can start.
  // preferences.sessionWarmupMs=0 / quietHoursStart=null disables the
  // config-driven suppression gates so the grace-period flow is exercised
  // in isolation.
  const cfg = {
    version: 3,
    apiUrl: "http://127.0.0.1:0", // unreachable; ad-cache will fall back to demo fixtures
    auth: {
      accessToken: "x",
      refreshToken: "x",
      accessTokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
    },
    user: { id: "user-1", githubLogin: "test", email: "t@example.com", avatarUrl: null },
    device: { id: "dev-1" },
    cli: { binPath },
    preferences: {
      blockedCategories: [],
      maxPerHour: 8,
      maxPerDay: 60,
      sessionWarmupMs: 0,
      quietHoursStart: null,
      quietHoursEnd: null,
      nightMode: false,
      tzOffsetMinutes: 0,
    },
  }
  writeFileSync(join(devdripDir, "config.json"), JSON.stringify(cfg), { mode: 0o600 })
})

afterEach(async () => {
  if (child && !child.killed) {
    child.kill("SIGKILL")
    await new Promise((r) => setTimeout(r, 50))
  }
  child = null
  rmSync(tempHome, { recursive: true, force: true })
})

function sendSocket(line: string): Promise<void> {
  return new Promise((resolve) => {
    const sock = createConnection(sockPath, () => sock.end(line + "\n"))
    sock.on("close", () => resolve())
    sock.on("error", () => resolve())
  })
}

function waitFor(fn: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = (): void => {
      if (fn()) return resolve()
      if (Date.now() - start > timeoutMs) return reject(new Error("timeout"))
      setTimeout(tick, 50)
    }
    tick()
  })
}

describe("daemon end-to-end (demo cache fallback)", () => {
  it("PreToolUse → 3s grace → demo ad displayed → Stop → ledger stays empty", async () => {
    child = spawn("node", [binPath, "daemon", "run"], {
      env: { ...process.env, HOME: tempHome },
      stdio: "ignore",
    })
    child.unref()

    // wait for heartbeat
    await waitFor(() => {
      try {
        const hb = JSON.parse(readFileSync(join(devdripDir, "daemon.heartbeat"), "utf8"))
        return typeof hb.pid === "number"
      } catch {
        return false
      }
    })

    // idle-start → grace → show → stop
    const target = join(tempHome, "fake-tty")
    writeFileSync(target, "")
    await sendSocket(JSON.stringify({ type: "idle-start", tty: target, pid: 1, ts: Date.now() }))
    // wait past grace
    await new Promise((r) => setTimeout(r, 3200))

    const rendered = readFileSync(target, "utf8")
    expect(rendered.length).toBeGreaterThan(0) // demo ad was written

    await sendSocket(JSON.stringify({ type: "idle-end", ts: Date.now() }))
    await new Promise((r) => setTimeout(r, 200))

    // demo ads should not land in the ledger (file may not exist at all)
    const ledgerExists = (() => {
      try {
        readFileSync(join(devdripDir, "ledger.db"))
        return true
      } catch {
        return false
      }
    })()
    // demo-only runs never write to the ledger, but openLedger on daemon start
    // creates the file. Assert the unsynced count is 0 via the status output.
    const out = execFileSync("node", [binPath, "daemon", "status"], {
      env: { ...process.env, HOME: tempHome },
      encoding: "utf8",
    })
    expect(out).toMatch(/unsynced:\s+0/)
    // suppress linter for unused var
    void ledgerExists

    // clean shutdown
    execFileSync("node", [binPath, "daemon", "stop"], {
      env: { ...process.env, HOME: tempHome },
      encoding: "utf8",
    })
  }, 10_000)

  it("daemon start is idempotent", async () => {
    execFileSync("node", [binPath, "daemon", "start"], {
      env: { ...process.env, HOME: tempHome },
      encoding: "utf8",
    })
    const second = execFileSync("node", [binPath, "daemon", "start"], {
      env: { ...process.env, HOME: tempHome },
      encoding: "utf8",
    })
    expect(second).toMatch(/daemon already running/)
    execFileSync("node", [binPath, "daemon", "stop"], {
      env: { ...process.env, HOME: tempHome },
      encoding: "utf8",
    })
  }, 10_000)
})
