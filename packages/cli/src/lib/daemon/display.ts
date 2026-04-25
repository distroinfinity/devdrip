import { closeSync, openSync, writeSync } from "node:fs"
import { renderBox } from "../render-box.js"
import type { CachedAd } from "../ad-cache.js"

export interface DisplayHandle {
  vanish(): void
}

export function showAd(ttyPath: string, ad: CachedAd): DisplayHandle {
  const fd = openSync(ttyPath, "w")
  let lineCount: number
  try {
    // S5-04 owns the [DEMO] badge; daemon renders the box without a source tag.
    const text = renderBox(ad)
    // one cursor-up per \n-separated chunk; the trailing \n we add below moves
    // the cursor to a blank line we don't need to erase.
    lineCount = text.split("\n").length
    writeSync(fd, text + "\n")
  } catch (err) {
    try {
      closeSync(fd)
    } catch {
      /* ignore */
    }
    throw err
  }

  let closed = false
  return {
    vanish() {
      if (closed) return
      closed = true
      try {
        writeSync(fd, `\x1b[${lineCount}A\x1b[0J`)
      } catch {
        /* tty may be gone; ignore */
      }
      try {
        closeSync(fd)
      } catch {
        /* ignore */
      }
    },
  }
}
