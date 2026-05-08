"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { AssetClass } from "@distrotv/shared"
import { SharpInput } from "@/components/v5/sharp-input"
import { SharpButton } from "@/components/v5/sharp-button"
import { saveWatchlistFromSetup } from "./actions"

const SEED: { symbol: string; assetClass: AssetClass }[] = [
  { symbol: "AAPL", assetClass: "equity" },
  { symbol: "MSFT", assetClass: "equity" },
  { symbol: "NVDA", assetClass: "equity" },
  { symbol: "BTC", assetClass: "crypto" },
  { symbol: "ETH", assetClass: "crypto" },
]

const KNOWN_CRYPTO = new Set(["BTC", "ETH", "SOL", "ADA", "XRP", "DOGE", "MATIC", "AVAX"])
const SYMBOL_RE = /^[A-Z0-9.\-]{1,16}$/

function inferAssetClass(s: string): AssetClass {
  return KNOWN_CRYPTO.has(s.toUpperCase()) ? "crypto" : "equity"
}

export function WatchlistClient() {
  const [picks, setPicks] = useState<{ symbol: string; assetClass: AssetClass }[]>(SEED)
  const [draft, setDraft] = useState("")
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function toggle(sym: string) {
    setPicks((p) => {
      if (p.some((t) => t.symbol === sym)) return p.filter((t) => t.symbol !== sym)
      const seedHit = SEED.find((s) => s.symbol === sym)
      if (!seedHit) return p
      return [...p, seedHit]
    })
  }

  function addCustom() {
    const sym = draft.trim().toUpperCase()
    if (!SYMBOL_RE.test(sym)) return
    if (picks.some((t) => t.symbol === sym)) return
    setPicks((p) => [...p, { symbol: sym, assetClass: inferAssetClass(sym) }])
    setDraft("")
  }

  function onSave() {
    if (picks.length === 0) {
      setError("pick at least one ticker (or skip later via /dashboard/watchlists)")
      return
    }
    setError(null)
    start(async () => {
      const result = await saveWatchlistFromSetup(picks)
      if (result.ok) router.push("/dashboard")
      else setError(result.error)
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {SEED.map((t) => {
          const on = picks.some((p) => p.symbol === t.symbol)
          return (
            <button
              key={t.symbol}
              type="button"
              onClick={() => toggle(t.symbol)}
              className={
                on
                  ? "px-3 py-2 border border-[var(--accent-color)] bg-[var(--accent-surface)] font-[var(--font-data)] text-[12px] text-[var(--ink-primary)] transition-colors"
                  : "px-3 py-2 border border-[var(--rule-default)] bg-[var(--bg-surface)] font-[var(--font-data)] text-[12px] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
              }
            >
              {t.symbol}
            </button>
          )
        })}
      </div>

      <div className="flex gap-2">
        <SharpInput
          type="text"
          placeholder="add a symbol (AAPL, BTC, …)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustom()}
          className="flex-1 font-[var(--font-data)]"
        />
        <SharpButton type="button" variant="secondary" onClick={addCustom}>
          add
        </SharpButton>
      </div>

      {picks.length > 0 && (
        <ul className="font-[var(--font-data)] text-[11px] text-[var(--ink-secondary)] space-y-0.5">
          {picks.map((p) => (
            <li key={p.symbol} className="flex items-center gap-2">
              <span className="text-[var(--ink-primary)]">{p.symbol}</span>
              <span className="text-[var(--ink-tertiary)]">{p.assetClass}</span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="font-[var(--font-data)] text-[11px] text-[var(--status-negative)]">{error}</p>
      )}

      <SharpButton
        type="button"
        variant="primary"
        onClick={onSave}
        disabled={pending}
        className="w-full"
      >
        {pending ? "saving…" : "Save and continue"}
      </SharpButton>
    </div>
  )
}
