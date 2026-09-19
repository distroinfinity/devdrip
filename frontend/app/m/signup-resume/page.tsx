"use client"

import { useEffect, useState } from "react"

// Bridges across iOS WebView cookie isolation after GitHub OAuth.
//
// The OAuth callback runs in iOS Safari (separate cookie jar from World App's
// WebView). Setting the session cookie there is useless because World App's
// WebView can't read it. Instead the callback mints a one-time resume code,
// embeds it in a world.org/mini-app deeplink, and bounces back into World App.
// World App opens this page IN ITS WebView; we POST the code to /miniapp/
// github-oauth/resume which sets the cookie INSIDE this WebView's jar.
export default function SignupResumePage({ searchParams }: { searchParams: { code?: string } }) {
  const [error, setError] = useState<string | null>(null)
  const code = searchParams.code

  useEffect(() => {
    if (!code) {
      setError("missing_code")
      return
    }
    let cancelled = false
    async function exchange() {
      try {
        const r = await fetch("/api/miniapp/github-oauth/resume", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code }),
        })
        if (!r.ok) {
          const body = (await r.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error ?? "resume_failed")
        }
        const data = (await r.json()) as { link_code?: string | null }
        if (cancelled) return
        const params = new URLSearchParams({ step: "done" })
        if (data.link_code) params.set("link", data.link_code)
        window.location.replace(`/m/signup?${params}`)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "unknown_error")
      }
    }
    void exchange()
    return () => {
      cancelled = true
    }
  }, [code])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg-primary)] px-6 text-center text-[var(--ink-primary)]">
      {error ? (
        <>
          <p className="text-red-500">Error: {error}</p>
          <a href="/m/signup" className="text-sm underline text-[var(--accent-color)]">
            Restart signup
          </a>
        </>
      ) : (
        <p className="text-[var(--ink-secondary)]">Returning to DevDrip…</p>
      )}
    </main>
  )
}
