import fs, { constants as fsConstants } from "node:fs"
import { WriteStream } from "node:tty"
import { renderSlotLine } from "../render-line.js"
import { writeStatusLine } from "../statusline-state.js"
import { getPendingUpdate } from "../update-nudge.js"
import type { ColorMode } from "../ansi.js"
import type { CachedSlot } from "../slot-cache.js"

// The daemon's own stdout is the log file (not a TTY), so detectColor() would
// strip color. We render onto Claude's statusLine, which supports truecolor —
// so force it on unless the user opted out via NO_COLOR.
const RENDER_COLOR: ColorMode = process.env["NO_COLOR"] ? "none" : "truecolor"
const FALLBACK_COLS = 80

// Read the terminal width off the tty path the hook handed us, so the panel can
// spread price/change/age across the real width. Best-effort — falls back to 80.
function readTtyCols(ttyPath: string): number {
  try {
    const fd = fs.openSync(ttyPath, fsConstants.O_WRONLY | fsConstants.O_NONBLOCK)
    try {
      return new WriteStream(fd).columns ?? FALLBACK_COLS
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return FALLBACK_COLS
  }
}

export interface RenderCtx {
  source?: string
  width?: number
}

export interface DisplayHandle {
  vanish(): { latencyMs: number }
  onResize(cb: () => void): void
  flash(): void
  updateProgress(progress: number, elapsedMs: number): void
  flashHeader(text: string, token: "positive" | "negative" | "muted" | "warning"): void
  shiftChart(newPoint: number): void
}

// Status-line rendering. The daemon NEVER writes to the user's TTY — that's
// what corrupted Claude Code's screen (two programs fighting for the same
// terminal). Instead we publish the current slot as one line to a local file;
// `distro statusline` reads it and Claude Code pins it at the bottom via its
// statusLine hook, owning the render entirely (zero contention, replaced in
// place — no scrollback spam).
//
// The orchestrator still drives show/vanish/progress timers for rotation +
// impression accounting, so the handle keeps its shape; the visual-only methods
// are no-ops.
export function showAd(ttyPath: string, slot: CachedSlot, ctx: RenderCtx = {}): DisplayHandle {
  try {
    const width = ctx.width ?? readTtyCols(ttyPath) - 4
    writeStatusLine(renderSlotLine(slot, RENDER_COLOR, width, getPendingUpdate() ?? undefined))
  } catch {
    /* display must never throw — the daemon stays up no matter what */
  }
  return {
    // keep the last line on screen between rotations so the bar stays pinned;
    // the daemon clears it on clean shutdown and the staleness TTL guards the
    // rest. clearing here would make the bottom bar flicker blank each gap.
    vanish: () => ({ latencyMs: 0 }),
    onResize: () => {},
    flash: () => {},
    updateProgress: () => {},
    flashHeader: () => {},
    shiftChart: () => {},
  }
}
