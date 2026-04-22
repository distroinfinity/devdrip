import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createConnection } from "node:net"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Event } from "../state-machine.js"

let tempDir = ""
let socketPath = ""

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "devdrip-server-"))
  socketPath = join(tempDir, "t.sock")
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

function send(line: string): Promise<void> {
  return new Promise((resolve) => {
    const sock = createConnection(socketPath, () => sock.end(line + "\n"))
    sock.on("close", () => resolve())
    sock.on("error", () => resolve())
  })
}

describe("startDaemonServer", () => {
  it("dispatches idle-start / idle-end / dismiss to the orchestrator", async () => {
    const received: Event[] = []
    const onKill = vi.fn()
    const { startDaemonServer } = await import("../server.js")
    const srv = await startDaemonServer({
      socketPath,
      dispatch: (ev) => received.push(ev),
      onKill,
      log: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    })

    await send(JSON.stringify({ type: "idle-start", tty: "/dev/ttys003", pid: 1, ts: 1 }))
    await send(JSON.stringify({ type: "idle-end", ts: 2 }))
    await send(JSON.stringify({ type: "dismiss", ts: 3 }))

    // yield so the server's end handler flushes
    await new Promise((r) => setTimeout(r, 30))

    expect(received.map((e) => e.kind)).toEqual(["idle-start", "idle-end", "dismiss"])
    expect(onKill).not.toHaveBeenCalled()
    await srv.close()
  })

  it("routes kill to onKill instead of dispatch", async () => {
    const received: Event[] = []
    const onKill = vi.fn()
    const { startDaemonServer } = await import("../server.js")
    const srv = await startDaemonServer({
      socketPath,
      dispatch: (ev) => received.push(ev),
      onKill,
      log: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    })

    await send(JSON.stringify({ type: "kill", ts: 1 }))
    await new Promise((r) => setTimeout(r, 30))

    expect(received).toHaveLength(0)
    expect(onKill).toHaveBeenCalledTimes(1)
    await srv.close()
  })

  it("drops malformed lines but keeps the connection alive", async () => {
    const received: Event[] = []
    const { startDaemonServer } = await import("../server.js")
    const srv = await startDaemonServer({
      socketPath,
      dispatch: (ev) => received.push(ev),
      onKill: () => {},
      log: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    })

    await new Promise<void>((resolve) => {
      const sock = createConnection(socketPath, () => {
        sock.write("not json\n")
        sock.end(JSON.stringify({ type: "idle-end", ts: 1 }) + "\n")
      })
      sock.on("close", () => resolve())
    })
    await new Promise((r) => setTimeout(r, 30))

    expect(received.map((e) => e.kind)).toEqual(["idle-end"])
    await srv.close()
  })
})
