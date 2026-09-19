"use client"

import { useEffect, useRef, useState } from "react"
import { formatUsdEstimate, formatUsdPrecise } from "@/lib/format"

const COUNT_MS = 700
const DELTA_HOLD_MS = 2_600

// the balance. when a refresh brings a higher value it counts up to it and shows
// what was just added — the one moving thing on the page.
export function LiveAmount({ value }: { value: number }) {
  const [shown, setShown] = useState(value)
  const [delta, setDelta] = useState<number | null>(null)
  const prev = useRef(value)

  useEffect(() => {
    const from = prev.current
    prev.current = value
    if (value === from) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (value < from || reduce) {
      setShown(value)
    } else {
      const start = performance.now()
      let raf = 0
      const step = (t: number) => {
        const k = Math.min(1, (t - start) / COUNT_MS)
        // ease-out so it settles rather than stops
        setShown(from + (value - from) * (1 - Math.pow(1 - k, 3)))
        if (k < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
      setDelta(value - from)
      const hide = setTimeout(() => setDelta(null), DELTA_HOLD_MS)
      return () => {
        cancelAnimationFrame(raf)
        clearTimeout(hide)
      }
    }
    return undefined
  }, [value])

  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <p
        className="font-data text-[48px] leading-none tracking-[-0.03em] tabular-nums text-[var(--ink-primary)] md:text-[64px]"
        aria-label={`${formatUsdEstimate(value)} estimated, all time`}
      >
        {formatUsdEstimate(shown)}
      </p>
      <span
        className={`font-data text-[14px] tabular-nums text-[var(--status-positive)] transition-opacity duration-500 ${
          delta === null ? "opacity-0" : "opacity-100"
        }`}
        aria-hidden
      >
        {delta === null ? "" : `+${formatUsdPrecise(delta)}`}
      </span>
    </div>
  )
}
