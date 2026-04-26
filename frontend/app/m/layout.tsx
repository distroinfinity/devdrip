"use client"

import { useEffect, useState, type ReactNode } from "react"
import { MiniKit } from "@worldcoin/minikit-js"
import { OpenInWorldApp } from "./_components/open-in-world-app"

const WORLD_APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID

// MiniKit.install() bridges to World App's native runtime over a postMessage
// channel that may take a frame or two to settle. Reading isInstalled()
// synchronously right after install() can return false even when we ARE
// inside the World App webview — most reliably reproduced when the page
// is reached via an OAuth round-trip redirect (the page load happens after
// the WebView has already torn down a previous bridge instance).
//
// We poll isInstalled() a few times with short backoffs before giving up
// and rendering the OpenInWorldApp fallback. The total wait is bounded
// (<= 1.2s) so a real browser still sees the fallback quickly.
const POLL_INTERVALS_MS = [0, 50, 100, 200, 400, 800] // cumulative ~1.5s
const MAX_POLLS = POLL_INTERVALS_MS.length

interface MiniAppLayoutProps {
  children: ReactNode
}

export default function MiniAppLayout({ children }: MiniAppLayoutProps) {
  const [installed, setInstalled] = useState<"unknown" | "yes" | "no">("unknown")

  useEffect(() => {
    if (!WORLD_APP_ID) {
      setInstalled("no")
      return
    }
    MiniKit.install(WORLD_APP_ID)
    let cancelled = false
    let attempt = 0
    function check() {
      if (cancelled) return
      if (MiniKit.isInstalled()) {
        setInstalled("yes")
        return
      }
      attempt += 1
      if (attempt >= MAX_POLLS) {
        setInstalled("no")
        return
      }
      const delay = POLL_INTERVALS_MS[attempt] ?? 800
      setTimeout(check, delay)
    }
    check()
    return () => {
      cancelled = true
    }
  }, [])

  if (installed === "unknown") return null
  if (installed === "no") return <OpenInWorldApp />
  return <>{children}</>
}
