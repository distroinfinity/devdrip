"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// re-runs the page's server components on an interval, only while the tab is visible
export function AutoRefresh({ everyMs = 5_000 }: { everyMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh()
    }, everyMs)
    return () => clearInterval(timer)
  }, [router, everyMs])

  return null
}
