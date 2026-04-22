import fs, { constants as fsConstants } from "node:fs"
import { renderBox, type RenderBoxOpts } from "../render-box.js"
import type { CachedAd } from "../ad-cache.js"

const MAX_WRITE_ATTEMPTS = 3

export interface RenderCtx {
  earningsUsdc?: number
  source?: string
  width?: number
}

export interface DisplayHandle {
  vanish(): { latencyMs: number }
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

export function showAd(ttyPath: string, ad: CachedAd, ctx: RenderCtx = {}): DisplayHandle {
  const flags = fsConstants.O_WRONLY | fsConstants.O_NONBLOCK
  const fd = fs.openSync(ttyPath, flags)
  try {
    const opts: RenderBoxOpts = {
      earningsUsdc: ctx.earningsUsdc,
      source: ctx.source,
      width: ctx.width,
    }
    const text = renderBox(ad, opts)
    // \x1b7: save cursor.  \x1b8\x1b[0J on vanish: restore cursor + erase to end of screen.
    // Scroll-safe; avoids fragile line-count + cursor-up arithmetic.
    writeWithRetry(fd, `\x1b7${text}\n`)
  } catch (err) {
    try {
      fs.closeSync(fd)
    } catch {
      /* ignore */
    }
    throw err
  }

  let closed = false
  return {
    vanish(): { latencyMs: number } {
      const t0 = Date.now()
      if (closed) return { latencyMs: 0 }
      closed = true
      try {
        writeWithRetry(fd, `\x1b8\x1b[0J`)
      } catch {
        /* tty may be gone; ignore */
      }
      try {
        fs.closeSync(fd)
      } catch {
        /* ignore */
      }
      return { latencyMs: Date.now() - t0 }
    },
  }
}
