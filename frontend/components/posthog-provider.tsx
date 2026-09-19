"use client"

import { useEffect } from "react"
import posthog from "posthog-js"

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key || posthog.__loaded) return
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      capture_exceptions: true,
      capture_pageview: false,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "*",
      },
      autocapture: false,
    })
  }, [])
  return <>{children}</>
}
