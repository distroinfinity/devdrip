import fs, { constants as fsConstants } from "node:fs"
import { WriteStream } from "node:tty"
import { renderNewsBox, type NewsRenderOpts } from "../render-box.js"
import { renderTickerBox } from "../render-ticker.js"
import type { ColorMode } from "../ansi.js"
import type { CachedSlot } from "../slot-cache.js"

// The daemon process's own stdout is the log file (not a TTY), so the
// renderer's default detectColor() heuristic returns "none" and strips
// every color from the slot. We render onto the *user's* tty (resolved
// via the tty path) — which IS a real terminal — so default to truecolor
// unless NO_COLOR is set in the daemon's env (inherited from the user's
// shell, so the opt-out signal still gets through).
const RENDER_COLOR: ColorMode = process.env["NO_COLOR"] ? "none" : "truecolor"

const MAX_WRITE_ATTEMPTS = 3
const FALLBACK_COLS = 80

// Read the terminal width off the fd. We never retain the WriteStream — we
// only need its reported column count to size the box; the raw fd is what we
// write through and close.
function readTtyCols(fd: number): number {
  try {
    const ws = new WriteStream(fd)
    return ws.columns ?? FALLBACK_COLS
  } catch {
    // fd isn't a tty (pipe, regular file, mocked fd in tests). fall back.
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

export function writeWithRetry(fd: number, data: string): void {
  let lastErr: unknown = null
  for (let i = 0; i < MAX_WRITE_ATTEMPTS; i++) {
    try {
      fs.writeSync(fd, data)
      return
    } catch (err) {
      lastErr = err
      if ((err as NodeJS.ErrnoException).code !== "EAGAIN") throw err
      // tight retry — EAGAIN on a tty is transient (kernel buffer full)
    }
  }
  throw lastErr as Error
}

// Inline, append-only render. The slot is written ONCE as a normal block of
// scrolling output and immediately becomes part of the terminal scrollback —
// no scroll region (DECSTBM), no cursor save/restore (DECSC/DECRC), no
// absolute positioning, no repaint timers, no vanish wipe.
//
// The previous "fixed bottom pane" approach carved the bottom rows with a
// scroll region and repainted them on timers. That fights Claude Code's TUI,
// which owns the same bottom rows (its input box + footer), the shared
// cursor-save register, and periodically resets the scroll region — so the
// two clobbered each other and corrupted the host screen. Appending plain
// text can't: it scrolls with Claude's own output like any other line.
//
// The orchestrator still drives show/vanish/progress timers for impression
// accounting, so we honor the handle shape with no-ops.
export function showAd(ttyPath: string, slot: CachedSlot, ctx: RenderCtx = {}): DisplayHandle {
  const flags = fsConstants.O_WRONLY | fsConstants.O_NONBLOCK
  const fd = fs.openSync(ttyPath, flags)
  try {
    const cols = ctx.width ?? readTtyCols(fd)
    const text =
      slot.kind === "ticker"
        ? renderTickerBox(slot, { width: cols, color: RENDER_COLOR })
        : renderNewsBox(slot as Parameters<typeof renderNewsBox>[0], {
            source: ctx.source,
            width: cols,
            color: RENDER_COLOR,
          } satisfies NewsRenderOpts)
    // CRLF between rows so the block lands cleanly whether the host left the
    // tty in cooked or raw mode; leading newline starts us on a fresh row and
    // the trailing SGR reset prevents color bleed into Claude's next write.
    const block = "\r\n" + text.split("\n").join("\r\n") + "\x1b[0m\r\n"
    writeWithRetry(fd, block)
  } finally {
    try {
      fs.closeSync(fd)
    } catch {
      /* ignore */
    }
  }

  return {
    vanish: () => ({ latencyMs: 0 }),
    onResize: () => {},
    flash: () => {},
    updateProgress: () => {},
    flashHeader: () => {},
    shiftChart: () => {},
  }
}
