import { spawn as cpSpawn } from "node:child_process"
import { Command } from "commander"
import * as nodePty from "node-pty"
import { daemonSocketPath } from "@distrotv/shared/daemon-socket"
import { sendHookEvent } from "../lib/daemon/hook-client.js"
import type { ActionKind } from "../lib/daemon/protocol.js"
import { resolveTtyForPid } from "../lib/daemon/tty.js"

const ESC = 0x1b
// A real terminal may deliver an ⌥ chord's `ESC` and its letter in separate
// read chunks. Hold a lone trailing ESC this long for the letter to arrive
// before treating it as a bare Escape keypress. Matches typical terminal ESC
// disambiguation timeouts, so a real Escape is delivered imperceptibly late.
const ESC_HOLD_MS = 25

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

  // The child is the PTY session leader, so this resolves to the PTY slave tty —
  // the exact path the child's own hooks report to the daemon. Sending it on
  // action events targets the right per-tty session even with two `dtv run`
  // windows open (otherwise the daemon's no-tty heuristic could hit the wrong
  // session). Resolved once; the child's tty doesn't change.
  const childTty = resolveTtyForPid(ptyProc.pid)

  const dispatch = (action: ActionKind): void => {
    void sendHookEvent(
      { type: "action", action, ...(childTty ? { tty: childTty } : {}) },
      daemonSocketPath()
    )
  }

  let restored = false
  let pendingEsc = false
  let escTimer: NodeJS.Timeout | null = null

  const clearEsc = (): void => {
    pendingEsc = false
    if (escTimer) {
      clearTimeout(escTimer)
      escTimer = null
    }
  }

  const toChild = (data: Buffer | string): void => {
    try {
      ptyProc.write(typeof data === "string" ? data : data.toString("utf8"))
    } catch {
      /* child already gone */
    }
  }

  // Route one already-assembled chunk: a Distro ⌥-chord is dispatched (and NOT
  // forwarded); everything else goes verbatim to the child. A lone trailing ESC
  // is held briefly (handled in onInput) in case it's the first half of a chord
  // split across read chunks.
  const route = (buf: Buffer): void => {
    if (buf.length === 0) return
    if (buf.length === 2 && buf[0] === ESC && buf[1] !== 0x5b /* [ */ && buf[1] !== 0x4f /* O */) {
      const action = chordToAction(String.fromCharCode(buf[1] as number))
      if (action) {
        dispatch(action)
        return
      }
    }
    if (buf.length === 1 && buf[0] === ESC) {
      pendingEsc = true
      escTimer = setTimeout(() => {
        escTimer = null
        pendingEsc = false
        if (!restored) toChild("\x1b") // no follow-up → it was a real Escape
      }, ESC_HOLD_MS)
      return
    }
    toChild(buf)
  }

  const onInput = (data: Buffer): void => {
    if (pendingEsc) {
      // stitch the held ESC back onto this chunk and route the whole sequence.
      clearEsc()
      route(Buffer.concat([Buffer.from([ESC]), data]))
      return
    }
    route(data)
  }

  const onResize = (): void => {
    try {
      ptyProc.resize(stdout.columns ?? 80, stdout.rows ?? 24)
    } catch {
      /* child already gone */
    }
  }

  const restore = (): void => {
    if (restored) return
    restored = true
    clearEsc()
    try {
      stdin.setRawMode?.(false)
    } catch {
      /* ignore */
    }
    stdin.pause()
    stdin.removeListener("data", onInput)
    stdout.removeListener("resize", onResize)
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
