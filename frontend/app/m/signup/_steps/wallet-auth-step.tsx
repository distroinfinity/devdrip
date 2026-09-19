"use client"

import { useState } from "react"
import { MiniKit } from "@worldcoin/minikit-js"
import { useRouter } from "next/navigation"

export function WalletAuthStep() {
  const router = useRouter()
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  async function handleConnect() {
    setStatus("loading")
    setError(null)
    try {
      const nonceResp = await fetch("/api/miniapp/wallet-auth/nonce", {
        method: "POST",
        credentials: "include",
      })
      if (!nonceResp.ok) throw new Error("nonce_failed")
      const { nonce } = (await nonceResp.json()) as { nonce: string }

      const result = await MiniKit.commandsAsync.walletAuth({ nonce })
      if (result.finalPayload.status === "error") {
        throw new Error(result.finalPayload.error_code ?? "walletauth_error")
      }

      const verifyResp = await fetch("/api/miniapp/wallet-auth/verify", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload: result.finalPayload, nonce }),
      })
      if (!verifyResp.ok) {
        const body = (await verifyResp.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? "verify_failed")
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error")
      setStatus("error")
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] p-5">
      <p className="text-[var(--ink-secondary)]">
        Connect your World Wallet. We&apos;ll bind it as the address you receive USDC payouts at.
      </p>
      <button
        type="button"
        disabled={status === "loading"}
        onClick={() => void handleConnect()}
        className="rounded-md bg-[var(--accent-color)] px-4 py-3 font-medium text-[var(--ink-inverse)] disabled:opacity-50"
      >
        {status === "loading" ? "Connecting..." : "Connect World Wallet"}
      </button>
      {error && <p className="text-sm text-red-500">Error: {error}</p>}
    </div>
  )
}
