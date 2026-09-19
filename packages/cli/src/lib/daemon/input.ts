import { closeSync, constants as fsConstants, openSync } from "node:fs"
import { ReadStream } from "node:tty"
import type { LoggerApi } from "./orchestrator.js"

export type KeyAction = "discover" | "skip" | "kill" | "mute" | "dismiss"

export interface KeyCapture {
  start(ttyPath: string): void
  // stop() with no argument stops every active capture (used at daemon shutdown).
  // stop(ttyPath) stops a single capture — called when an ad on that tty vanishes.
  stop(ttyPath?: string): void
}

export interface KeyCaptureDeps {
  // S3-14: onKey receives the tty the key came from so the orchestrator can
  // route the action to the right per-tty session. Multiple captures can be
  // active simultaneously (one per tty with a live ad).
  onKey: (action: KeyAction, ttyPath: string) => void
  log: LoggerApi
}

// pure: classify a single raw-mode read chunk into at most one action.
// - multi-byte chunks starting with ESC are terminal control sequences
//   (focus-in/out, arrow keys, mouse events, function keys) — never ours.
// - lone ESC (chunk.length === 1, byte = 0x1b) is the user pressing Escape.
// - first mapped byte wins; remaining bytes in the chunk are discarded
//   (paste protection / held-key deduplication).
export function processByteChunk(chunk: Buffer): KeyAction | null {
  if (chunk.length > 1 && chunk[0] === 0x1b) return null
  const str = chunk.toString("utf8")
  for (const ch of str) {
    const action = byteToAction(ch)
    if (action) return action
  }
  return null
}

export function byteToAction(byte: string): KeyAction | null {
  switch (byte) {
    case "d":
    case "D":
      return "discover"
    case "s":
    case "S":
      return "skip"
    case "k":
    case "K":
      return "kill"
    case "m":
    case "M":
      return "mute"
    case "\r":
    case "\n":
    case " ":
    case "\x1b":
    case "\x03":
      return "dismiss"
    default:
      return null
  }
}

interface ActiveCapture {
  fd: number
  stream: ReadStream
}

export function createKeyCapture(deps: KeyCaptureDeps): KeyCapture {
  // S3-14: one ActiveCapture per tty path. Two concurrent Claude Code
  // terminals each need their own fd + ReadStream, and a key in tty-A must
  // never be routed to tty-B's session. stopping a single tty leaves others
  // running; shutdown calls stop() with no arg to drop them all.
  const captures = new Map<string, ActiveCapture>()

  function stopOne(ttyPath: string): void {
    const active = captures.get(ttyPath)
    if (!active) return
    captures.delete(ttyPath)
    // Deliberately DO NOT call setRawMode(false): Claude Code owns the tty's
    // raw-mode setting for its own REPL. Flipping it off here was corrupting
    // Claude's stdin after vanish (keystrokes went to the line buffer).
    // tty.ReadStream owns the fd via its libuv handle, so destroy() closes it.
    // A subsequent closeSync(fd) would close whatever resource the kernel
    // reassigned that number to — silently, since it's wrapped in try/catch.
    try {
      active.stream.destroy()
    } catch {
      /* ignore */
    }
  }

  function stop(ttyPath?: string): void {
    if (ttyPath !== undefined) {
      stopOne(ttyPath)
      return
    }
    for (const key of [...captures.keys()]) stopOne(key)
  }

  function start(ttyPath: string): void {
    if (captures.has(ttyPath)) return
    let fd: number
    try {
      fd = openSync(ttyPath, fsConstants.O_RDONLY | fsConstants.O_NONBLOCK)
    } catch (err) {
      deps.log.warn("key-capture open failed", {
        ttyPath,
        error: (err as Error).message,
      })
      return
    }
    let stream: ReadStream
    try {
      stream = new ReadStream(fd)
      stream.setRawMode(true)
    } catch (err) {
      deps.log.warn("key-capture init failed", { error: (err as Error).message })
      try {
        closeSync(fd)
      } catch {
        /* ignore */
      }
      return
    }

    captures.set(ttyPath, { fd, stream })
    deps.log.info("key-capture started", { ttyPath, fd })

    stream.on("data", (chunk: Buffer) => {
      // diagnostic: log every chunk's hex bytes so we can tell whether a
      // missing key action is (a) our daemon never saw the byte (Claude won
      // the race) or (b) we saw the byte but the mapper / dispatch path
      // is broken. stays at debug level; grep with `grep "key-capture byte"`.
      const hex = chunk.toString("hex")
      deps.log.debug("key-capture byte", { hex, len: chunk.length, ttyPath })
      const action = processByteChunk(chunk)
      if (!action) {
        if (chunk.length > 1 && chunk[0] === 0x1b) {
          deps.log.debug("key-capture dropped control sequence", { hex, ttyPath })
        }
        return
      }
      deps.log.info("key-capture action", { action, ttyPath })
      deps.onKey(action, ttyPath)
    })
    stream.on("error", (err) => {
      deps.log.warn("key-capture stream error", { error: err.message, ttyPath })
    })
  }

  return { start, stop }
}
