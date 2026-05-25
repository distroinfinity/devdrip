"use client"

import { useEffect } from "react"
import posthog from "posthog-js"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (posthog.__loaded) posthog.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <p>Something went wrong.</p>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  )
}
