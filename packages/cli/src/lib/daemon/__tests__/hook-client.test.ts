import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { createServer, type Server } from "node:net"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

let server: Server | null = null
let received: string[] = []
let socketPath = ""
let tempDir = ""

beforeEach(() => {
  received = []
  tempDir = mkdtempSync(join(tmpdir(), "devdrip-hook-client-"))
  socketPath = join(tempDir, "test.sock")
})

afterEach(async () => {
  if (server) {
    const s = server
    server = null
    // closeAllConnections was added in Node 23.1.0
    ;(s as unknown as { closeAllConnections?: () => void }).closeAllConnections?.()
    await new Promise<void>((resolve) => {
      const closeTimeout = setTimeout(() => resolve(), 100)
      s.close(() => {
        clearTimeout(closeTimeout)
        resolve()
      })
    })
  }
  rmSync(tempDir, { recursive: true, force: true })
})

function startServer(): Promise<void> {
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

describe("sendHookEvent", () => {
  it("connects + sends JSON + closes", async () => {
    await startServer()
    const { sendHookEvent } = await import("../hook-client.js")
    await sendHookEvent({ type: "idle-start", tty: "/dev/ttys003" }, socketPath)
    // brief yield so the server's "end" handler runs
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(received).toHaveLength(1)
    const item = received[0]
    if (!item) throw new Error("expected received[0]")
    const parsed = JSON.parse(item)
    expect(parsed).toEqual({ type: "idle-start", tty: "/dev/ttys003" })
  })

  it("resolves silently when the daemon isn't running (ENOENT)", async () => {
    const { sendHookEvent } = await import("../hook-client.js")
    await expect(sendHookEvent({ type: "idle-end" }, socketPath)).resolves.toBeUndefined()
  })

  it(
    "resolves on timeout when the server never accepts data",
    async () => {
      // server that accepts connections but never reads — client's setTimeout fires
      server = createServer(() => {
        /* intentionally ignore */
      })
      await new Promise<void>((resolve) => {
        if (!server) throw new Error("server not initialized")
        server.listen(socketPath, () => resolve())
      })

      const { sendHookEvent } = await import("../hook-client.js")
      const start = Date.now()
      await sendHookEvent({ type: "idle-end" }, socketPath)
      const elapsed = Date.now() - start
      // wide envelope — just verify we didn't hang indefinitely
      expect(elapsed).toBeLessThan(500)
    },
    { timeout: 1000 }
  )
})
