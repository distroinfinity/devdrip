"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface LinkCliCardProps {
  linkCode: string
}

export function LinkCliCard({ linkCode }: LinkCliCardProps) {
  const router = useRouter()
  const [status, setStatus] = useState<"idle" | "loading" | "linked" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  async function handleLink() {
    setStatus("loading")
    setError(null)
    try {
      const r = await fetch(`/api/miniapp/cli-link/${linkCode}`, {
        method: "POST",
        credentials: "include",
      })
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? "link_failed")
      }
      setStatus("linked")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "unknown_error")
    }
  }

  if (status === "linked") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">CLI linked ✓</h2>
        <p className="text-[var(--ink-secondary)]">
          Return to your terminal — your <code>devdrip login</code> session is now active.
        </p>
        <button
          type="button"
          onClick={() => router.push("/m/wallet")}
          className="rounded-md border border-[var(--border-subtle)] px-4 py-3 font-medium"
        >
          Go to wallet
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Link your CLI?</h2>
      <p className="text-[var(--ink-secondary)]">
        Pair code: <code className="rounded bg-[var(--bg-secondary)] px-2 py-1">{linkCode}</code>
      </p>
      <button
        type="button"
        disabled={status === "loading"}
        onClick={() => void handleLink()}
        className="rounded-md bg-[var(--accent)] px-4 py-3 font-medium text-[var(--bg-primary)] disabled:opacity-50"
      >
        {status === "loading" ? "Linking..." : "Link this CLI"}
      </button>
      {error && <p className="text-sm text-red-500">Error: {error}</p>}
    </div>
  )
}
