"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LinkCliCard } from "../_components/link-cli-card"

interface CompleteStepProps {
  linkCode?: string
}

export function CompleteStep({ linkCode }: CompleteStepProps) {
  const router = useRouter()
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function finalize() {
      try {
        const r = await fetch("/api/miniapp/signup/complete", {
          method: "POST",
          credentials: "include",
        })
        if (!r.ok) {
          const body = (await r.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error ?? "complete_failed")
        }
        if (!cancelled) setCompleted(true)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "unknown_error")
      }
    }
    void finalize()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <p className="text-sm text-red-500">Error: {error}</p>
  if (!completed) return <p className="text-[var(--ink-secondary)]">Finalizing…</p>

  if (linkCode) {
    return <LinkCliCard linkCode={linkCode} />
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] p-5">
      <h2 className="text-xl font-semibold">You&apos;re in 🎉</h2>
      <p className="text-[var(--ink-secondary)]">
        Welcome to DevDrip. Head to your wallet to start earning.
      </p>
      <button
        type="button"
        onClick={() => router.push("/m/wallet")}
        className="rounded-md bg-[var(--accent-color)] px-4 py-3 font-medium text-[var(--ink-inverse)]"
      >
        Go to wallet
      </button>
    </div>
  )
}
