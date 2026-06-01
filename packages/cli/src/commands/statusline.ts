import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { Command } from "commander"
import { readStatusLine } from "../lib/statusline-state.js"
import { parseStatuslineInput, recordUsage } from "../lib/claude-usage.js"
import { readWrappedStatusLine } from "../lib/wrapped-statusline.js"

// Invoked by Claude Code's statusLine on a cadence. Claude pipes session JSON
// on stdin; we (1) snapshot that telemetry for CH 03, (2) run the user's
// original status line (if Distro wrapped one) and emit its output, then
// (3) append our current slot line BELOW it. Must be fast and never throw.

// Read stdin only when it's piped — reading fd 0 on an interactive tty blocks.
function readStdin(): string {
  if (process.stdin.isTTY) return ""
  try {
    return readFileSync(0, "utf8")
  } catch {
    return ""
  }
}

export const statuslineCmd = new Command("statusline")
  .description("print the current Distro TV slot as one line (used by Claude Code's statusLine)")
  .action(() => {
    const input = readStdin()

    // snapshot telemetry for the utilities channel — best-effort.
    if (input) {
      try {
        recordUsage(parseStatuslineInput(input, Date.now()))
      } catch {
        /* ignore */
      }
    }

    const parts: string[] = []

    // run the wrapped (user's original) status line first, feeding it the same
    // stdin. Tight timeout so a slow custom line can't stall Claude's render.
    const wrapped = readWrappedStatusLine()
    if (wrapped) {
      try {
        const res = spawnSync("sh", ["-c", wrapped.command], {
          input,
          encoding: "utf8",
          timeout: 800,
          maxBuffer: 1024 * 1024,
        })
        const out = (res.stdout ?? "").replace(/\n+$/, "")
        if (out.length > 0) parts.push(out)
      } catch {
        /* fall through — show our line alone */
      }
    }

    // our slot line below the wrapped output (empty when nothing is playing).
    try {
      const ours = readStatusLine()
      if (ours.length > 0) parts.push(ours)
    } catch {
      /* ignore */
    }

    try {
      process.stdout.write(parts.join("\n"))
    } catch {
      /* ignore */
    }
    process.exit(0)
  })
