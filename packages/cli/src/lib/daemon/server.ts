import { chmodSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { createServer } from "node:net"
import {
  parseWireEvent,
  type KillEvent,
  type ReloadConfigEvent,
  type WireEvent,
} from "./protocol.js"
import type { Event } from "./state-machine.js"
import type { LoggerApi } from "./orchestrator.js"

// Wire events that flow through the state machine. `kill` and `reload-config`
// are admin control messages intercepted by `handleLine` before reaching here.
type StateWireEvent = Exclude<WireEvent, KillEvent | ReloadConfigEvent>

export interface DaemonServer {
  close(): Promise<void>
}

export interface StartDaemonServerOpts {
  socketPath: string
  dispatch: (event: Event) => void
  onKill: () => void
  onReloadConfig?: () => void
  log: LoggerApi
}

// A well-behaved hook payload is ~150 bytes. Cap buffers at 4KB so a rogue
// client that never sends a newline can't grow memory without bound.
const MAX_LINE_BYTES = 4096

export async function startDaemonServer(opts: StartDaemonServerOpts): Promise<DaemonServer> {
  const server = createServer((sock) => {
    let buffer = ""
    sock.on("data", (chunk) => {
      buffer += chunk.toString("utf8")
      if (buffer.length > MAX_LINE_BYTES) {
        opts.log.warn("hook line exceeded buffer cap; disconnecting", {
          bytes: buffer.length,
        })
        sock.destroy()
        return
      }
      let nl: number
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl)
        buffer = buffer.slice(nl + 1)
        if (!line) continue
        handleLine(line, opts)
      }
    })
    sock.on("error", (err) => {
      opts.log.warn("socket error", { message: err.message })
    })
  })

  // ensure parent dir exists before listen — covers the /tmp fallback path too
  mkdirSync(dirname(opts.socketPath), { recursive: true, mode: 0o700 })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(opts.socketPath, () => {
      server.off("error", reject)
      resolve()
    })
  })

  // Post-startup errors (e.g., the socket file gets unlinked out from under us)
  // would otherwise crash the daemon. Log and keep running.
  server.on("error", (err) => {
    opts.log.warn("server socket error (post-startup)", { message: err.message })
  })

  try {
    chmodSync(opts.socketPath, 0o600)
  } catch {
    /* some fs don't honor chmod on sockets */
  }

  return {
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
      }),
  }
}

function handleLine(line: string, opts: StartDaemonServerOpts): void {
  const parsed = parseWireEvent(line)
  if (!parsed) {
    opts.log.warn("invalid event", { line })
    return
  }
  if (parsed.type === "kill") {
    opts.log.info("kill received")
    opts.onKill()
    return
  }
  if (parsed.type === "reload-config") {
    opts.log.info("reload-config received")
    opts.onReloadConfig?.()
    return
  }
  opts.dispatch(toStateEvent(parsed))
}

function toStateEvent(w: StateWireEvent): Event {
  const now = Date.now()
  switch (w.type) {
    case "idle-start":
      return { kind: "idle-start", tty: w.tty, now }
    case "idle-end":
      return { kind: "idle-end", now, tty: w.tty }
    case "dismiss":
      return { kind: "dismiss", now, tty: w.tty }
    case "session-start":
      return { kind: "session-start", now, tty: w.tty }
    case "action":
      switch (w.action) {
        case "discover":
          return { kind: "discover-key", now, tty: w.tty }
        case "skip":
          return { kind: "skip-key", now, tty: w.tty }
        case "kill-session":
          return { kind: "kill-key", now, tty: w.tty }
        case "mute":
          return { kind: "mute-key", now, tty: w.tty }
        case "dismiss":
          return { kind: "dismiss", now, tty: w.tty }
      }
  }
}
