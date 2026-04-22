import { closeSync, openSync, writeSync } from "node:fs"
import { renderBox } from "../render-box.js"
import type { CachedAd } from "../ad-cache.js"

export interface DisplayHandle {
  vanish(): void
}

export function showAd(ttyPath: string, ad: CachedAd): DisplayHandle {
  const fd = openSync(ttyPath, "w")
  // S5-04 owns the [DEMO] badge; daemon renders the box without a source tag.
  const text = renderBox(ad)
  // split on "\n" then +1 for the trailing newline we add after the box
  const lineCount = text.split("\n").length
  writeSync(fd, text + "\n")

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
