import { Command } from "commander"
import { readStatusLine } from "../lib/statusline-state.js"

// Invoked by Claude Code's statusLine hook on a cadence. Claude pipes session
// JSON on stdin (ignored) and renders our stdout at the bottom. Must be fast
// and must never throw — print the current slot line (or nothing) and exit.
export const statuslineCmd = new Command("statusline")
  .description("print the current Distro TV slot as one line (used by Claude Code's statusLine)")
  .action(() => {
    try {
      process.stdout.write(readStatusLine())
    } catch {
      /* print nothing on any failure */
    }
    process.exit(0)
  })
