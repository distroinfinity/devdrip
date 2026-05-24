import { spawn as cpSpawn } from "node:child_process"
import { Command } from "commander"
import * as nodePty from "node-pty"
import { daemonSocketPath } from "@distrotv/shared/daemon-socket"
import { sendHookEvent } from "../lib/daemon/hook-client.js"
import type { ActionKind } from "../lib/daemon/protocol.js"

const ESC = 0x1b

// Meta (Alt/Option) chord letter → daemon action. Same letters as the daemon's
// raw-capture map, expressed in the socket's ActionKind vocabulary.
function chordToAction(letter: string): ActionKind | null {
  switch (letter.toLowerCase()) {
    case "d":
      return "discover"
    case "s":
      return "skip"
    case "k":
      return "kill-session"
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

// Returns an action only when the chunk is EXACTLY a 2-byte Meta chord we own
// (`ESC` + action letter). Everything else — bare keys, Enter, lone ESC, arrow
// keys, function keys, pastes, multi-byte UTF-8 — returns null and is forwarded
// verbatim to the child. That's the whole point: Distro claims its chords and
// nothing else, so Claude's input is never stolen.
export function interceptChord(data: Buffer): ActionKind | null {
  if (data.length === 2 && data[0] === ESC) {
    const second = data[1] as number
    if (second === 0x5b /* [ */ || second === 0x4f /* O */) return null // CSI / SS3
    return chordToAction(String.fromCharCode(second))
  }
  return null
}

export const runCmd = new Command("run")
  .description(
    "run a command (default: claude) with Distro TV overlaid — Distro owns the keyboard and forwards every key except its ⌥ chords to the child"
  )
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .argument("[command...]", "command to run, e.g. claude (default: claude)")
  .action(async (command: string[]) => {
    const argv = command.length > 0 ? command : ["claude"]
    await runWrapped(argv[0] as string, argv.slice(1))
  })

async function runWrapped(file: string, args: string[]): Promise<void> {
  const stdin = process.stdin
  const stdout = process.stdout

  // No interactive tty (CI, pipes): we can't multiplex raw input, so just exec
  // the child with inherited stdio. No chord capture, no surprises.
  if (!stdin.isTTY || !stdout.isTTY) {
    await new Promise<void>((resolve) => {
      const child = cpSpawn(file, args, { stdio: "inherit" })
      child.on("exit", (code) => {
        process.exitCode = code ?? 0
        resolve()
      })
      child.on("error", (err) => {
        console.error(`failed to start ${file}: ${err.message}`)
        process.exitCode = 127
        resolve()
      })
    })
    return
  }

  let ptyProc: nodePty.IPty
  try {
    ptyProc = nodePty.spawn(file, args, {
      name: process.env.TERM ?? "xterm-256color",
      cols: stdout.columns ?? 80,
      rows: stdout.rows ?? 24,
      cwd: process.cwd(),
      // DISTRO_PTY=1 tells the child's Distro hooks to mark the daemon session
      // wrapper-owned, so the daemon skips its own (racy) tty key capture.
      env: { ...process.env, DISTRO_PTY: "1" },
    })
  } catch (err) {
    console.error(`failed to start ${file}: ${(err as Error).message}`)
    process.exitCode = 127
    return
  }

  let restored = false
  const restore = (): void => {
    if (restored) return
    restored = true
    try {
      stdin.setRawMode?.(false)
    } catch {
      /* ignore */
    }
    stdin.pause()
    stdin.removeListener("data", onInput)
    stdout.removeListener("resize", onResize)
  }

  const onInput = (data: Buffer): void => {
    const action = interceptChord(data)
    if (action) {
      // fire-and-forget to the daemon; no tty → routes to the active session.
      // crucially, do NOT forward these bytes to the child.
      void sendHookEvent({ type: "action", action }, daemonSocketPath())
      return
    }
    ptyProc.write(data.toString("utf8"))
  }

  const onResize = (): void => {
    try {
      ptyProc.resize(stdout.columns ?? 80, stdout.rows ?? 24)
    } catch {
      /* child already gone */
    }
  }

  stdin.setRawMode?.(true)
  stdin.resume()
  stdin.on("data", onInput)
  stdout.on("resize", onResize)

  ptyProc.onData((d) => stdout.write(d))
  ptyProc.onExit(({ exitCode }) => {
    restore()
    process.exit(exitCode ?? 0)
  })

  // forward terminal signals to the child rather than dying ourselves.
  process.on("SIGINT", () => {
    try {
      ptyProc.kill("SIGINT")
    } catch {
      /* ignore */
    }
  })
  process.on("SIGTERM", () => {
    try {
      ptyProc.kill("SIGTERM")
    } catch {
      /* ignore */
    }
  })
  process.on("exit", restore)
}
