"use client"

import { useEffect, useState, type ReactNode } from "react"
import { MiniKit } from "@worldcoin/minikit-js"
import { OpenInWorldApp } from "./_components/open-in-world-app"

const WORLD_APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID

interface MiniAppLayoutProps {
  children: ReactNode
}

// Client-side gate: MiniKit.isInstalled() returns true only inside World App's
// webview. In a regular browser the user sees the Open-in-World-App landing.
//
// We don't render the children at all when MiniKit isn't installed — server
// fetches in child server components (e.g., /m/wallet) would otherwise hit the
// /miniapp/me 401 path repeatedly. Better UX: just show the landing.
export default function MiniAppLayout({ children }: MiniAppLayoutProps) {
  const [installed, setInstalled] = useState<"unknown" | "yes" | "no">("unknown")

  useEffect(() => {
    if (!WORLD_APP_ID) {
      // Misconfig — the env var is a hard requirement. Treat as not-installed
      // so the landing renders with a copy-link the user can troubleshoot with.
      setInstalled("no")
      return
    }
    MiniKit.install(WORLD_APP_ID)
    setInstalled(MiniKit.isInstalled() ? "yes" : "no")
  }, [])

  if (installed === "unknown") {
    // Briefly null while MiniKit hydrates.
    return null
  }
  if (installed === "no") return <OpenInWorldApp />

  return <>{children}</>
}
