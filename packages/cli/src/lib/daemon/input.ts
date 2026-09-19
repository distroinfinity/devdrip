import { closeSync, constants as fsConstants, openSync } from "node:fs"
import { ReadStream } from "node:tty"
import type { LoggerApi } from "./orchestrator.js"

export type KeyAction = "discover" | "skip" | "kill" | "mute" | "dismiss" | "save" | "chart"

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

const ESC = 0x1b

// pure: classify a single raw-mode read chunk into at most one action.
//
// Distro only claims Alt/Option chords (Meta = ESC + letter) plus a lone ESC
// for dismiss. Bare letters, Enter, Space, Ctrl+C are deliberately left alone:
// the user is typing into Claude Code on the same tty, and a bare `d` must reach
// Claude, not fire `discover`. That ambiguity was the whole bug.
//
// - lone ESC (length 1, 0x1b) → dismiss (the user pressed Escape).
// - ESC + <action letter> (Option+letter on macOS) → that action.
// - ESC + `[` (CSI) or ESC + `O` (SS3) → control sequence (arrows, function
//   keys, focus/mouse events, bracketed paste) → ignored.
// - anything else → ignored (passes through to Claude untouched).
export function processByteChunk(chunk: Buffer): KeyAction | null {
  if (chunk.length === 1 && chunk[0] === ESC) return "dismiss"
  if (chunk.length >= 2 && chunk[0] === ESC) {
    const second = chunk[1]
    if (second === 0x5b /* [ */ || second === 0x4f /* O */) return null
    return letterToAction(String.fromCharCode(second as number))
  }
  return null
}

// Maps the letter following a Meta (ESC) prefix to an action. Case-insensitive
// so Option+D and Option+Shift+D both work. Returns null for any non-action
// letter (e.g. Alt+a) so it's ignored rather than mis-fired.
export function letterToAction(letter: string): KeyAction | null {
  switch (letter.toLowerCase()) {
    case "d":
      return "discover"
    case "s":
      return "skip"
    case "k":
      return "kill"
    case "m":
      return "mute"
    case "b":
      return "save"
    case "c":
      return "chart"
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
