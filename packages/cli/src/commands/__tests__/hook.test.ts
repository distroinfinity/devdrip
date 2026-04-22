import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createServer, type Server } from "node:net"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

let tempDir = ""
let socketPath = ""
let server: Server | null = null
let received: string[] = []

beforeEach(() => {
  vi.resetModules()
  tempDir = mkdtempSync(join(tmpdir(), "devdrip-hook-cmd-"))
  socketPath = join(tempDir, "t.sock")
  received = []
})

afterEach(async () => {
  if (server) {
    const s = server
    await new Promise<void>((r) => s.close(() => r()))
  }
  server = null
  rmSync(tempDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function startEcho(): Promise<void> {
  return new Promise((resolve) => {
    server = createServer((sock) => {
      let buf = ""
      sock.on("data", (chunk) => {
        buf += chunk.toString("utf8")
      })
      sock.on("end", () => {
        received.push(buf.trim())
      })
    })
    server.listen(socketPath, () => resolve())
  })
}

describe("hook subcommands", () => {
  it("pre-tool sends idle-start with the resolved tty", async () => {
    await startEcho()
    vi.doMock("../../lib/daemon/tty.js", () => ({
      resolveTty: () => "/dev/ttys042",
      resetTtyCache: () => {
        // noop
      },
    }))
    const { handlePreTool } = await import("../hook.js")
    await handlePreTool(socketPath)
    await new Promise((r) => setTimeout(r, 20))
    expect(received).toHaveLength(1)
    const msg = received[0]
    expect(msg).toBeDefined()
    const got = JSON.parse(msg ?? "")
    expect(got.type).toBe("idle-start")
    expect(got.tty).toBe("/dev/ttys042")
  })

  it("pre-tool tolerates tty resolution failure (sends tty: null)", async () => {
    await startEcho()
    vi.doMock("../../lib/daemon/tty.js", () => ({
      resolveTty: () => null,
      resetTtyCache: () => {
        // noop
      },
    }))
    const { handlePreTool } = await import("../hook.js")
    await handlePreTool(socketPath)
    await new Promise((r) => setTimeout(r, 20))
    const msg = received[0]
    expect(msg).toBeDefined()
    expect(JSON.parse(msg ?? "").tty).toBeNull()
  })

  it("stop sends idle-end", async () => {
    await startEcho()
    const { handleStop } = await import("../hook.js")
    await handleStop(socketPath)
    await new Promise((r) => setTimeout(r, 20))
    const msg = received[0]
    expect(msg).toBeDefined()
    expect(JSON.parse(msg ?? "").type).toBe("idle-end")
  })

  it("prompt-submit sends dismiss", async () => {
    await startEcho()
    const { handlePromptSubmit } = await import("../hook.js")
    await handlePromptSubmit(socketPath)
    await new Promise((r) => setTimeout(r, 20))
    const msg = received[0]
    expect(msg).toBeDefined()
    expect(JSON.parse(msg ?? "").type).toBe("dismiss")
  })

  it("resolves silently with no server", async () => {
    const { handlePreTool } = await import("../hook.js")
    await expect(handlePreTool(socketPath)).resolves.toBeUndefined()
  })
})
