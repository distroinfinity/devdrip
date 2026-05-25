import { renderSlotLine } from "../render-line.js"
import { writeStatusLine, clearStatusLine } from "../statusline-state.js"
import type { CachedSlot } from "../slot-cache.js"

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
export function showAd(_ttyPath: string, slot: CachedSlot, _ctx: RenderCtx = {}): DisplayHandle {
  try {
    writeStatusLine(renderSlotLine(slot))
  } catch {
    /* display must never throw — the daemon stays up no matter what */
  }
  return {
    vanish: () => {
      clearStatusLine()
      return { latencyMs: 0 }
    },
    onResize: () => {},
    flash: () => {},
    updateProgress: () => {},
    flashHeader: () => {},
    shiftChart: () => {},
  }
}
