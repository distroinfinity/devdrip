import { closeSync, constants as fsConstants, openSync } from "node:fs"
import { ReadStream } from "node:tty"
import type { LoggerApi } from "./orchestrator.js"

export type KeyAction = "discover" | "skip" | "kill" | "mute" | "dismiss"

export interface KeyCapture {
  start(ttyPath: string): void
  stop(): void
}

export interface KeyCaptureDeps {
  onKey: (action: KeyAction) => void
  log: LoggerApi
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
  let active: ActiveCapture | null = null

  function stop(): void {
    if (!active) return
    const { fd, stream } = active
    active = null
    try {
      stream.setRawMode(false)
    } catch (err) {
      deps.log.warn("key-capture setRawMode(false) failed", { error: (err as Error).message })
    }
    try {
      stream.destroy()
    } catch {
      /* ignore */
    }
    try {
      closeSync(fd)
    } catch {
      /* ignore */
    }
  }

  function start(ttyPath: string): void {
    if (active) return
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

    active = { fd, stream }

    stream.on("data", (chunk: Buffer) => {
      const str = chunk.toString("utf8")
      for (const ch of str) {
        const action = byteToAction(ch)
        if (action) {
          deps.onKey(action)
          return
        }
      }
    })
    stream.on("error", (err) => {
      deps.log.warn("key-capture stream error", { error: err.message })
    })
  }

  return { start, stop }
}
