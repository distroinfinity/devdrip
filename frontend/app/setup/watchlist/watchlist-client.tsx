"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { AssetClass } from "@distrotv/shared"
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {SEED.map((t) => {
          const on = picks.some((p) => p.symbol === t.symbol)
          return (
            <button
              key={t.symbol}
              type="button"
              onClick={() => toggle(t.symbol)}
              className={
                on
                  ? "px-3 py-2 rounded-md border border-black bg-black text-white text-sm font-mono"
                  : "px-3 py-2 rounded-md border border-gray-300 text-sm font-mono"
              }
            >
              {t.symbol}
            </button>
          )
        })}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="add a symbol (AAPL, BTC, …)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono"
        />
        <button type="button" onClick={addCustom} className="px-3 py-2 bg-gray-200 rounded text-sm">
          add
        </button>
      </div>

      <ul className="text-xs text-gray-600">
        {picks.map((p) => (
          <li key={p.symbol}>
            {p.symbol} <span className="text-gray-400">({p.assetClass})</span>
          </li>
        ))}
      </ul>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="w-full px-4 py-2 bg-black text-white rounded text-sm disabled:opacity-50"
      >
        {pending ? "saving…" : "Save and continue"}
      </button>
    </div>
  )
}
