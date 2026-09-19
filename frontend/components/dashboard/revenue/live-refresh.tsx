"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

const REFRESH_MS = 5_000

function ago(iso: string | null, now: number): string {
  if (!iso) return "no ads yet"
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return `last ad ${s}s ago`
  if (s < 3600) return `last ad ${Math.floor(s / 60)}m ago`
  return `last ad ${Math.floor(s / 3600)}h ago`
}

// re-runs the server components every few seconds while the tab is visible, so the
// page follows the terminal. the dot is "on air" only if an ad landed in the last minute.
export function LiveRefresh({ lastSeenAt }: { lastSeenAt: string | null }) {
  const router = useRouter()
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const tick = setInterval(() => setNow(Date.now()), 1_000)
    const refresh = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh()
    }, REFRESH_MS)
    return () => {
      clearInterval(tick)
      clearInterval(refresh)
    }
  }, [router])

  // render nothing time-based until mounted, so server and client markup match
  if (now === null) return <span className="h-[14px]" aria-hidden />

  const onAir = lastSeenAt !== null && now - new Date(lastSeenAt).getTime() < 60_000
  return (
    <span
      className="inline-flex items-center gap-2 font-data text-[11px] tabular-nums text-[var(--ink-tertiary)]"
      aria-live="off"
    >
      <span
        className={
          onAir
            ? "h-1.5 w-1.5 bg-[var(--status-positive)] motion-safe:animate-pulse"
            : "h-1.5 w-1.5 bg-[var(--ink-tertiary)] opacity-50"
        }
        aria-hidden
      />
      {onAir ? "live" : "idle"} · {ago(lastSeenAt, now)}
    </span>
  )
}
