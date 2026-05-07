"use client"

import { useState, useTransition } from "react"
import type { WatchlistDto, AssetClass } from "@distrotv/shared"
import { saveWatchlists } from "./actions"

const KNOWN_CRYPTO = new Set(["BTC", "ETH", "SOL", "ADA", "XRP", "DOGE", "MATIC", "AVAX"])
const SYMBOL_RE = /^[A-Z0-9.\-]{1,16}$/

function inferAssetClass(s: string): AssetClass {
  return KNOWN_CRYPTO.has(s.toUpperCase()) ? "crypto" : "equity"
}

export function WatchlistsClient({ initial }: { initial: WatchlistDto[] }) {
  const [lists, setLists] = useState(initial)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})

  function persist(next: WatchlistDto[]) {
    const replacement = next.map((l) => ({
      name: l.name,
      tickers: l.tickers.map((t) => ({ symbol: t.symbol, assetClass: t.assetClass })),
    }))
    start(async () => {
      const result = await saveWatchlists(replacement)
      if (result.ok && result.watchlists) {
        setLists(result.watchlists)
        setError(null)
      } else {
        setError(result.error ?? "save failed")
      }
    })
  }

  function addTicker(listId: string) {
    const raw = (draft[listId] ?? "").trim().toUpperCase()
    if (!SYMBOL_RE.test(raw)) {
      setError("invalid symbol")
      return
    }
    const target = lists.find((l) => l.id === listId)
    if (target?.tickers.some((t) => t.symbol === raw)) {
      // already present — clear the draft input but skip the redundant PUT
      setDraft((d) => ({ ...d, [listId]: "" }))
      setError(`${raw} already in ${target.name}`)
      return
    }
    const next = lists.map((l) =>
      l.id !== listId
        ? l
        : {
            ...l,
            tickers: [
              ...l.tickers,
              {
                symbol: raw,
                assetClass: inferAssetClass(raw),
                priority: l.tickers.length,
                addedAt: new Date().toISOString(),
              },
            ],
          }
    )
    setDraft((d) => ({ ...d, [listId]: "" }))
    persist(next)
  }

  function removeTicker(listId: string, symbol: string) {
    const next = lists.map((l) =>
      l.id !== listId ? l : { ...l, tickers: l.tickers.filter((t) => t.symbol !== symbol) }
    )
    const target = next.find((l) => l.id === listId)
    if (target && target.tickers.length === 0) {
      setError("at least one ticker must stay in each watchlist")
      return
    }
    persist(next)
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {lists.map((l) => (
        <section
          key={l.id}
          className="rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] px-5 py-5"
        >
          <h2 className="font-display text-[14px] font-bold text-[var(--ink-primary)]">
            {l.name} <span className="text-[var(--ink-tertiary)]">· {l.tickers.length}</span>
          </h2>
          <ul className="mt-3 divide-y divide-[var(--rule-default)]">
            {l.tickers.map((t) => (
              <li key={t.symbol} className="flex items-center justify-between py-2">
                <span className="font-mono text-[13px]">
                  {t.symbol}{" "}
                  <span className="text-[var(--ink-tertiary)] text-[11px]">{t.assetClass}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeTicker(l.id, t.symbol)}
                  disabled={pending}
                  className="text-[11px] text-[var(--ink-tertiary)] hover:text-red-600 disabled:opacity-50"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              placeholder="symbol (e.g. AAPL, BTC)"
              value={draft[l.id] ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, [l.id]: e.target.value }))}
              className="flex-1 px-3 py-2 border border-[var(--rule-default)] rounded text-sm font-mono"
              disabled={pending}
            />
            <button
              type="button"
              onClick={() => addTicker(l.id)}
              disabled={pending}
              className="px-3 py-2 bg-[var(--accent-color)] text-white rounded text-sm disabled:opacity-50"
            >
              add
            </button>
          </div>
        </section>
      ))}
    </div>
  )
}
