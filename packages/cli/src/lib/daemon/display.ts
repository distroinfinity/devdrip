import fs, { constants as fsConstants } from "node:fs"
import { WriteStream } from "node:tty"
import {
  BAR_PULSE_INTERVAL_MS,
  CHART_SHIFT_MS,
  REVEAL_STAGGER_MS,
  SAVE_FLASH_FADE_MS,
  SAVE_FLASH_HOLD_MS,
  VANISH_WIPE_PER_ROW_MS,
} from "@distrotv/shared"
import { renderNewsBox, type NewsRenderOpts } from "../render-box.js"
import { renderTickerBox } from "../render-ticker.js"
import type { ColorMode } from "../ansi.js"

// The daemon process's own stdout is the log file (not a TTY), so the
// renderer's default detectColor() heuristic returns "none" and strips
// every color from the slot. We render onto the *user's* tty (resolved
// via the tty path) — which IS a real terminal — so default to truecolor
// unless NO_COLOR is set in the daemon's env (inherited from the user's
// shell, so the opt-out signal still gets through).
const RENDER_COLOR: ColorMode = process.env["NO_COLOR"] ? "none" : "truecolor"
import type { CachedSlot } from "../slot-cache.js"

const MAX_WRITE_ATTEMPTS = 3

// minimum vertical headroom we need for Claude's output above the ad pane.
// if the tty has fewer rows than adHeight + this, we skip the render.
const MIN_SCROLL_REGION_ROWS = 4

// fallbacks when the tty stream doesn't report dimensions (pipes, CI, tests).
const FALLBACK_ROWS = 24
const FALLBACK_COLS = 80

// poll cadence for detecting terminal resize while the ad is visible.
// SIGWINCH is delivered to Claude (the controlling tty foreground process),
// not to our detached daemon, so we poll dimensions ourselves.
const RESIZE_POLL_MS = 500

function readTtyDimensions(fd: number): { rows: number; cols: number; ws: WriteStream | null } {
  try {
    const ws = new WriteStream(fd)
    return {
      rows: ws.rows ?? FALLBACK_ROWS,
      cols: ws.columns ?? FALLBACK_COLS,
      ws,
    }
  } catch {
    // fd isn't a tty (pipe, regular file, mocked fd in tests). fall back to
    // safe defaults; the orchestrator's caller already handles tiny terminals.
    return { rows: FALLBACK_ROWS, cols: FALLBACK_COLS, ws: null }
  }
}

export interface RenderCtx {
  source?: string
  width?: number
}

export interface DisplayHandle {
  vanish(): { latencyMs: number }
  // fires when the terminal's rows or columns change during showing.
  // the display cleans up its own scroll region proactively; the orchestrator
  // should treat this as a signal to dismiss the current ad so the next
  // rotation re-anchors with fresh dimensions.
  onResize(cb: () => void): void
  // visually highlight the box border to confirm to the user that their
  // keystroke was captured by Distro TV and not consumed by Claude. The
  // highlight stays until the orchestrator vanishes the box (~150ms later).
  flash(): void
  // redraw the box with a new progress value. cheap re-render — reuses the scroll region anchor.
  updateProgress(progress: number, elapsedMs: number): void
  // save/skip/kill confirmation flash per spec §11.
  flashHeader(text: string, token: "positive" | "negative" | "muted" | "warning"): void
  // Append a fresh datapoint to a ticker slot's sparkline and re-render.
  // No-op for non-ticker slots.
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

// anchor the slot to the bottom of the tty via DECSTBM (set-top-bottom-margin).
// this lets Claude Code's output scroll freely in the upper region without
// overlapping our box. without it, the cursor-save/restore trick gets its
// anchor clobbered the moment Claude writes anything between show and vanish.
export function showAd(ttyPath: string, slot: CachedSlot, ctx: RenderCtx = {}): DisplayHandle {
  const flags = fsConstants.O_WRONLY | fsConstants.O_NONBLOCK
  const fd = fs.openSync(ttyPath, flags)

  let scrollBottom: number
  let initialRows: number
  let initialCols: number
  let ws: WriteStream | null
  // captured for flash() so we can re-emit the box with highlighted chrome.
  let lastRenderedText = ""
  // hoisted so paintRow (called inside the try block) can read them on first tick.
  let closed = false
  let resizeFired = false
  let wipeInProgress = false
  let flashTimer: NodeJS.Timeout | null = null
  const baseNewsOpts: NewsRenderOpts = {
    source: ctx.source,
    width: ctx.width,
    color: RENDER_COLOR,
  }

  function renderInitial(): string {
    if (slot.kind === "ticker") {
      return renderTickerBox(slot, { width: ctx.width ?? initialCols, color: RENDER_COLOR })
    }
    return renderNewsBox(slot as Parameters<typeof renderNewsBox>[0], baseNewsOpts)
  }

  function renderTick(progress: number, elapsedMs: number): string {
    if (slot.kind === "ticker") {
      return renderTickerBox(slot, {
        width: ctx.width ?? initialCols,
        progress,
        elapsedMs,
        color: RENDER_COLOR,
      })
    }
    return renderNewsBox(slot as Parameters<typeof renderNewsBox>[0], {
      ...baseNewsOpts,
      progress,
      elapsedMs,
    })
  }

  try {
    const dims = readTtyDimensions(fd)
    initialRows = dims.rows
    initialCols = dims.cols
    ws = dims.ws

    baseNewsOpts.width = ctx.width ?? initialCols
    const text = renderInitial()
    const adHeight = text.split("\n").length
    lastRenderedText = text

    if (initialRows < adHeight + MIN_SCROLL_REGION_ROWS) {
      throw new Error(
        `tty too short: rows=${initialRows}, need ${adHeight + MIN_SCROLL_REGION_ROWS}`
      )
    }

    scrollBottom = initialRows - adHeight

    const setRegion = `\x1b[1;${scrollBottom}r`
    const moveToBottomPane = `\x1b[${scrollBottom + 1};1H`
    // Initial paint with reveal stagger per spec §11. Set the scroll region
    // and erase the pane once, then write rows one at a time with a 40ms
    // delay between each. Cursor save/restore preserves the user's prompt
    // position throughout.
    const rows = text.split("\n")
    writeWithRetry(fd, `\x1b7${setRegion}${moveToBottomPane}\x1b[0J\x1b8`)
    let painted = 0
    const paintRow = (): void => {
      if (closed || wipeInProgress || resizeFired) return
      if (painted >= rows.length) return
      const rowText = rows[painted] ?? ""
      const row = scrollBottom + 1 + painted
      try {
        writeWithRetry(fd, `\x1b7\x1b[${row};1H\x1b[2K${rowText}\x1b8`)
      } catch {
        return
      }
      painted++
      if (painted < rows.length) setTimeout(paintRow, REVEAL_STAGGER_MS)
    }
    paintRow()
  } catch (err) {
    try {
      fs.closeSync(fd)
    } catch {
      /* ignore */
    }
    throw err
  }

  const resizeSubs: Array<() => void> = []

  function emitResetSequence(): void {
    const moveToBottomPane = `\x1b[${scrollBottom + 1};1H`
    try {
      writeWithRetry(fd, `\x1b7\x1b[r${moveToBottomPane}\x1b[0J\x1b8`)
    } catch {
      /* tty may be gone; ignore */
    }
  }

  // Vanish wipe motion per spec §11. Clears the slot pane row-by-row from
  // bottom to top, ~20ms per row, total <200ms (the hard rule).
  function wipeSlot(rowCount: number): void {
    if (closed) return
    const rowsToWipe = Math.max(1, rowCount)
    let i = 0
    const tick = (): void => {
      if (closed || i >= rowsToWipe) {
        emitResetSequence()
        return
      }
      // Overwrite row from the bottom up by clearing the bottom of the pane
      // line-by-line. Each iteration shrinks the scroll region by one row.
      const clearedBottom = scrollBottom + rowsToWipe - i
      try {
        writeWithRetry(fd, `\x1b7\x1b[${clearedBottom};1H\x1b[2K\x1b8`)
      } catch {
        /* tty gone; abort wipe */
        closed = true
        return
      }
      i++
      setTimeout(tick, VANISH_WIPE_PER_ROW_MS)
    }
    tick()
  }

  // Save / skip / kill confirmation flash per spec §11. Triggers a 1.2s
  // banner ("✓ saved", "↪ skipped", "✕ killed") in the header strip area.
  // Implementation: re-render the entire pane with the renderer's `flash` opt,
  // hold for SAVE_FLASH_HOLD_MS, then re-render without the flash. The
  // renderer handles colour + placement.
  function flashHeader(text: string, token: "positive" | "negative" | "muted" | "warning"): void {
    if (closed || wipeInProgress || resizeFired) return
    // Cancel any in-flight un-flash from a previous flashHeader call —
    // otherwise the previous un-flash would clobber this new flash mid-hold.
    if (flashTimer) {
      clearTimeout(flashTimer)
      flashTimer = null
    }
    const flashed = renderWithFlash({ flash: { text, token } })
    if (flashed) {
      lastRenderedText = flashed
      writePane(flashed, "")
    }
    // After hold, re-render without flash. The fade-in / fade-out from the
    // spec is approximated by token cycling; here we collapse to a single
    // hold step because most terminals can't render true opacity.
    flashTimer = setTimeout(
      () => {
        flashTimer = null
        if (closed || wipeInProgress || resizeFired) return
        const restored = renderWithFlash({})
        if (restored) {
          lastRenderedText = restored
          writePane(restored, "")
        }
      },
      SAVE_FLASH_FADE_MS + SAVE_FLASH_HOLD_MS + SAVE_FLASH_FADE_MS
    )
  }

  function renderWithFlash(flashOpts: {
    flash?: { text: string; token: "positive" | "negative" | "muted" | "warning" }
  }): string | null {
    try {
      if (slot.kind === "ticker") {
        return renderTickerBox(slot, {
          width: ctx.width ?? initialCols,
          color: RENDER_COLOR,
          ...flashOpts,
        })
      }
      return renderNewsBox(slot as Parameters<typeof renderNewsBox>[0], {
        ...baseNewsOpts,
        ...flashOpts,
      })
    } catch {
      return null
    }
  }

  // Chart shift on data tick per spec §11. Receives a new datapoint, mutates
  // the cached slot's sparkline buffer (drop first, append last), and
  // re-renders. The 120ms ease is approximated by sleeping CHART_SHIFT_MS/2
  // before the redraw — terminals don't natively interpolate, but the brief
  // hold reads as motion when the user is glancing.
  function shiftChart(newPoint: number): void {
    if (closed || wipeInProgress || resizeFired) return
    if (slot.kind !== "ticker") return
    // Mutate the buffer in place — the daemon owns the cached slot.
    slot.sparkline.shift()
    slot.sparkline.push(newPoint)
    // Hold half the shift duration to let the eye register motion, then redraw.
    setTimeout(
      () => {
        if (closed || wipeInProgress || resizeFired) return
        const text = renderTickerBox(slot, { width: ctx.width ?? initialCols, color: RENDER_COLOR })
        lastRenderedText = text
        writePane(text, "")
      },
      Math.floor(CHART_SHIFT_MS / 2)
    )
  }

  // poll terminal dimensions. if they change, reset the scroll region
  // immediately (to prevent Claude's subsequent output from clipping) and
  // notify subscribers so the orchestrator can dismiss and re-anchor.
  const resizeTimer: NodeJS.Timeout | null = ws
    ? setInterval(() => {
        if (closed || resizeFired) return
        const currentRows = ws.rows ?? initialRows
        const currentCols = ws.columns ?? initialCols
        if (currentRows !== initialRows || currentCols !== initialCols) {
          resizeFired = true
          if (pulseTimer) clearInterval(pulseTimer)
          if (flashTimer) {
            clearTimeout(flashTimer)
            flashTimer = null
          }
          emitResetSequence()
          for (const cb of resizeSubs) {
            try {
              cb()
            } catch {
              /* subscribers must not throw */
            }
          }
        }
      }, RESIZE_POLL_MS)
    : null

  function writePane(text: string, colorPrefix: string): void {
    if (closed || resizeFired) return
    // Re-assert DECSTBM on every pane write. Claude Code's animated status
    // banner periodically resets the default scroll region, and without this
    // re-assert our next multi-line write spills past the (now full-screen)
    // scroll region's bottom and scrolls the terminal — stacking old boxes
    // above the new one. Cheap to include; ~7 bytes per tick.
    const setRegion = `\x1b[1;${scrollBottom}r`
    const moveToBottomPane = `\x1b[${scrollBottom + 1};1H`
    // \x1b7 save, re-assert region, move to pane top, erase pane, write new
    // content, restore cursor back into Claude's scroll region. SGR reset
    // (\x1b[0m) tail guarantees no color bleed into subsequent writes.
    try {
      writeWithRetry(
        fd,
        `\x1b7${setRegion}${moveToBottomPane}\x1b[0J${colorPrefix}${text}\x1b[0m\x1b8`
      )
    } catch {
      /* tty may be gone; ignore */
    }
  }

  function rewriteBox(colorPrefix: string): void {
    if (!lastRenderedText) return
    writePane(lastRenderedText, colorPrefix)
  }

  // Bar pulse per spec §11. Cycles the first character of the header line
  // (`▍`) between full indigo and muted indigo every BAR_PULSE_INTERVAL_MS.
  // The rest of the header stays cached in lastRenderedText; we only re-emit
  // row 1 of the pane so the cost is one short ANSI write per frame.
  const totalFrames = Math.round(2200 / BAR_PULSE_INTERVAL_MS) // 20 frames over 2.2s
  let pulsePhase = 0
  let pulseTimer: NodeJS.Timeout | null = null
  if (!closed && !resizeFired) {
    pulseTimer = setInterval(() => {
      if (closed || wipeInProgress || resizeFired) return
      pulsePhase = (pulsePhase + 1) % totalFrames
      // Triangle wave from 0 (full indigo) → half → 0 (full indigo).
      const t = pulsePhase / totalFrames
      const halfwave = t < 0.5 ? t * 2 : (1 - t) * 2 // 0 → 1 → 0
      const useDim = halfwave > 0.55
      const barEscape = useDim
        ? "\x1b[38;2;80;84;168m" // indigoDim
        : "\x1b[38;2;129;140;248m" // indigo
      const row = scrollBottom + 1 // first row of the pane
      try {
        writeWithRetry(fd, `\x1b7\x1b[${row};1H${barEscape}▍\x1b[0m\x1b8`)
      } catch {
        /* tty gone; clear ourselves */
        if (pulseTimer) clearInterval(pulseTimer)
      }
    }, BAR_PULSE_INTERVAL_MS)
  }

  return {
    vanish(): { latencyMs: number } {
      const t0 = Date.now()
      if (closed || wipeInProgress) return { latencyMs: 0 }
      if (resizeTimer) clearInterval(resizeTimer)
      if (pulseTimer) clearInterval(pulseTimer)
      if (flashTimer) {
        clearTimeout(flashTimer)
        flashTimer = null
      }
      // On resize-triggered teardown we skip the wipe and use the existing
      // emitResetSequence path — the slot is already considered invalid.
      if (resizeFired) {
        closed = true
        try {
          fs.closeSync(fd)
        } catch {
          /* ignore */
        }
        return { latencyMs: Date.now() - t0 }
      }
      // Wipe rows bottom-to-top before closing the fd. `wipeInProgress` blocks a
      // second vanish() call from re-entering during the animation; `closed` is
      // set only AFTER the wipe completes (otherwise the wipe's recursive ticks
      // would hit the `if (closed)` guard and abort the animation after row 1).
      const rowCount = lastRenderedText ? lastRenderedText.split("\n").length : 0
      wipeInProgress = true
      wipeSlot(rowCount)
      setTimeout(
        () => {
          closed = true
          wipeInProgress = false
          try {
            fs.closeSync(fd)
          } catch {
            /* ignore */
          }
        },
        rowCount * VANISH_WIPE_PER_ROW_MS + 20
      )
      return { latencyMs: Date.now() - t0 }
    },
    onResize(cb: () => void): void {
      resizeSubs.push(cb)
    },
    flash(): void {
      // bright green highlight to confirm the keystroke was captured by
      // Distro TV, not Claude. the orchestrator vanishes the box ~150ms
      // later, so the green pulse stays on until vanish — no revert needed.
      rewriteBox("\x1b[1;92m")
    },
    updateProgress(progress: number, elapsedMs: number): void {
      if (closed || resizeFired) return
      const text = renderTick(progress, elapsedMs)
      lastRenderedText = text
      writePane(text, "")
    },
    flashHeader(text, token) {
      flashHeader(text, token)
    },
    shiftChart(newPoint) {
      shiftChart(newPoint)
    },
  }
}
