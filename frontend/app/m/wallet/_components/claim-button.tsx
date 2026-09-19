"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatUsdc } from "@devdrip/shared/format"
import { MIN_PAYOUT_USDC } from "@devdrip/shared/constants/chain"
import { claim, fetchPayout, type PayoutSummary } from "@/lib/wallet-api"

interface ClaimButtonProps {
  available: number
  canClaim: boolean
}

export function ClaimButton({ available, canClaim }: ClaimButtonProps) {
  const router = useRouter()
  const [status, setStatus] = useState<"idle" | "claiming" | "polling" | "done" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [poll, setPoll] = useState<PayoutSummary | null>(null)

  async function handleClaim() {
    setStatus("claiming")
    setError(null)
    const idempotencyKey = crypto.randomUUID()
    try {
      const result = await claim(idempotencyKey)
      setStatus("polling")
      // Poll up to 60s; the settlement worker confirms most payouts within ~30-45s.
      const startedAt = Date.now()
      while (Date.now() - startedAt < 60_000) {
        const payout = await fetchPayout(result.id)
        setPoll(payout)
        if (payout.status === "confirmed" || payout.status === "failed") {
          setStatus("done")
          router.refresh()
          return
        }
        await new Promise((r) => setTimeout(r, 3_000))
      }
      // Polling timed out — leave status visible; the page will show updates on next refresh.
      setStatus("done")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error")
      setStatus("error")
    }
  }

  if (!canClaim) {
    return (
      <p className="text-xs text-[var(--ink-secondary)]">
        Need at least {formatUsdc(MIN_PAYOUT_USDC)} to claim. Keep earning.
      </p>
    )
  }

  if (status === "polling" && poll) {
    return <p className="text-sm text-[var(--ink-secondary)]">Claim in flight: {poll.status}…</p>
  }

  return (
    <>
      <button
        type="button"
        disabled={status === "claiming" || status === "polling"}
        onClick={() => void handleClaim()}
        className="rounded-md bg-[var(--accent)] px-4 py-3 font-medium text-[var(--bg-primary)] disabled:opacity-50"
      >
        {status === "claiming" ? "Submitting…" : `Claim ${formatUsdc(available)}`}
      </button>
      {error && <p className="text-sm text-red-500">Error: {error}</p>}
    </>
  )
}
