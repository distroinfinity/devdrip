"use client"

import { useState } from "react"
import { MiniKit, VerificationLevel } from "@worldcoin/minikit-js"
import { useRouter } from "next/navigation"

export function WorldIdStep() {
  const router = useRouter()
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  async function handleVerify() {
    setStatus("loading")
    setError(null)
    try {
      const result = await MiniKit.commandsAsync.verify({
        action: "devdrip-signup",
        verification_level: VerificationLevel.Device,
      })
      if (result.finalPayload.status === "error") {
        throw new Error(result.finalPayload.error_code ?? "verify_error")
      }

      const verifyResp = await fetch("/api/miniapp/world-id/verify", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proof: result.finalPayload }),
      })
      if (!verifyResp.ok) {
        const body = (await verifyResp.json().catch(() => null)) as { error?: string } | null
        if (body?.error === "nullifier_already_used") {
          throw new Error("This World ID is already linked to another account.")
        }
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
        Verify with World ID to prove you&apos;re a unique human. Device verification works — no Orb
        needed.
      </p>
      <button
        type="button"
        disabled={status === "loading"}
        onClick={() => void handleVerify()}
        className="rounded-md bg-[var(--accent-color)] px-4 py-3 font-medium text-[var(--ink-inverse)] disabled:opacity-50"
      >
        {status === "loading" ? "Verifying..." : "Verify with World ID"}
      </button>
      {error && <p className="text-sm text-red-500">Error: {error}</p>}
    </div>
  )
}
