import fs, { constants as fsConstants } from "node:fs"
import { WriteStream } from "node:tty"
import { SAVE_FLASH_FADE_MS, SAVE_FLASH_HOLD_MS, VANISH_WIPE_PER_ROW_MS } from "@distrotv/shared"
import { renderNewsBox, type NewsRenderOpts } from "../render-box.js"
import { renderTickerBox } from "../render-ticker.js"
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
  const baseNewsOpts: NewsRenderOpts = {
    source: ctx.source,
    width: ctx.width,
  }

  function renderInitial(): string {
    if (slot.kind === "ticker") {
      return renderTickerBox(slot, { width: ctx.width ?? initialCols })
    }
    return renderNewsBox(slot as Parameters<typeof renderNewsBox>[0], baseNewsOpts)
  }

  function renderTick(progress: number, elapsedMs: number): string {
    if (slot.kind === "ticker") {
      return renderTickerBox(slot, { width: ctx.width ?? initialCols, progress, elapsedMs })
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
    writeWithRetry(fd, `\x1b7${setRegion}${moveToBottomPane}\x1b[0J${text}\x1b8`)
  } catch (err) {
    try {
      fs.closeSync(fd)
    } catch {
      /* ignore */
    }
    throw err
  }

  let closed = false
  let wipeInProgress = false
  let resizeFired = false
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
    const flashed = renderWithFlash({ flash: { text, token } })
    if (flashed) {
      lastRenderedText = flashed
      writePane(flashed, "")
    }
    // After hold, re-render without flash. The fade-in / fade-out from the
    // spec is approximated by token cycling; here we collapse to a single
    // hold step because most terminals can't render true opacity.
    setTimeout(
      () => {
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

  return {
    vanish(): { latencyMs: number } {
      const t0 = Date.now()
      if (closed || wipeInProgress) return { latencyMs: 0 }
      if (resizeTimer) clearInterval(resizeTimer)
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
  }
}
