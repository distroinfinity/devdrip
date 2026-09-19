import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

let tempHome = ""

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "devdrip-daemon-cmd-"))
  process.env["HOME"] = tempHome
  mkdirSync(join(tempHome, ".devdrip"), { recursive: true, mode: 0o700 })
})

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true })
})

describe("daemon status", () => {
  it('reports "not running" with no heartbeat', async () => {
    const { runStatus } = await import("../daemon.js")
    const out = await runStatus()
    expect(out).toMatch(/daemon:\s+not running/)
  })

  it("reports running with fresh heartbeat", async () => {
    const hb = {
      version: 1,
      pid: 12345,
      startedAt: Date.now() - 10_000,
      lastHeartbeat: Date.now() - 1000,
      socketPath: "/tmp/x.sock",
      adsShownThisSession: 2,
      hooksReceivedThisSession: 17,
    }
    writeFileSync(join(tempHome, ".devdrip", "daemon.heartbeat"), JSON.stringify(hb), {
      mode: 0o600,
    })
    const { runStatus } = await import("../daemon.js")
    const out = await runStatus()
    expect(out).toMatch(/daemon:\s+running/)
    expect(out).toMatch(/pid=12345/)
    expect(out).toMatch(/hooks:\s+17 received this session/)
    expect(out).toMatch(/ads shown:\s+2/)
  })

  it("reports stale heartbeat", async () => {
    const hb = {
      version: 1,
      pid: 12345,
      startedAt: Date.now() - 120_000,
      lastHeartbeat: Date.now() - 60_000,
      socketPath: "/tmp/x.sock",
      adsShownThisSession: 0,
      hooksReceivedThisSession: 0,
    }
    writeFileSync(join(tempHome, ".devdrip", "daemon.heartbeat"), JSON.stringify(hb), {
      mode: 0o600,
    })
    const { runStatus } = await import("../daemon.js")
    const out = await runStatus()
    expect(out).toMatch(/daemon:\s+stale/)
  })
})
