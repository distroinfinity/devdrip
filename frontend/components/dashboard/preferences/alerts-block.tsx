"use client"

import { useState } from "react"
import type { AlertDto } from "@distrotv/shared"

const SYMBOL_RE = /^[A-Z0-9.\-]{1,16}$/

interface Override {
  symbol: string
  thresholdPct: number
}

interface Props {
  alerts: AlertDto[]
  onChange: (next: AlertDto[]) => void
  disabled?: boolean
}

export function AlertsBlock({ alerts, onChange, disabled }: Props) {
  const globalRule = alerts.find((a) => a.scope === "global")
  const overrides: Override[] = alerts
    .filter((a) => a.scope === "per_ticker" && a.symbol)
    .map((a) => ({ symbol: a.symbol as string, thresholdPct: a.thresholdPct }))

  const [draftSymbol, setDraftSymbol] = useState("")
  const [draftThreshold, setDraftThreshold] = useState("5")
  const [error, setError] = useState<string | null>(null)

  function setGlobalThreshold(n: number) {
    const next: AlertDto[] = [
      {
        id: globalRule?.id ?? "",
        scope: "global",
        symbol: null,
        thresholdPct: n,
        createdAt: globalRule?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ...alerts.filter((a) => a.scope === "per_ticker"),
    ]
    onChange(next)
  }

  function addOverride() {
    const sym = draftSymbol.trim().toUpperCase()
    const n = Number(draftThreshold)
    if (!SYMBOL_RE.test(sym)) {
      setError("invalid symbol")
      return
    }
    if (!Number.isFinite(n) || n < 0.5 || n > 50) {
      setError("threshold must be 0.5..50")
      return
    }
    if (overrides.some((o) => o.symbol === sym)) {
      setError(`${sym} already has an override`)
      return
    }
    setError(null)
    const next: AlertDto[] = [
      ...alerts,
      {
        id: "",
        scope: "per_ticker",
        symbol: sym,
        thresholdPct: n,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
    setDraftSymbol("")
    setDraftThreshold("5")
    onChange(next)
  }

  function removeOverride(symbol: string) {
    onChange(alerts.filter((a) => !(a.scope === "per_ticker" && a.symbol === symbol)))
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[12px] text-[var(--ink-secondary)]">
          global threshold (% daily move)
        </label>
        <input
          type="number"
          step="0.5"
          min="0.5"
          max="50"
          value={globalRule?.thresholdPct ?? 5}
          onChange={(e) => setGlobalThreshold(Number(e.target.value))}
          disabled={disabled}
          className="mt-1 px-3 py-2 border border-[var(--rule-default)] rounded text-sm font-mono w-32"
        />
      </div>

      {overrides.length > 0 && (
        <div>
          <p className="text-[12px] text-[var(--ink-secondary)] mb-2">per-ticker overrides</p>
          <ul className="divide-y divide-[var(--rule-default)]">
            {overrides.map((o) => (
              <li key={o.symbol} className="flex items-center justify-between py-2">
                <span className="font-mono text-[13px]">
                  {o.symbol} <span className="text-[var(--ink-tertiary)]">@ {o.thresholdPct}%</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeOverride(o.symbol)}
                  disabled={disabled}
                  className="text-[11px] text-[var(--ink-tertiary)] hover:text-red-600 disabled:opacity-50"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div>
          <label className="block text-[11px] text-[var(--ink-tertiary)]">
            add override — symbol
          </label>
          <input
            type="text"
            placeholder="AAPL"
            value={draftSymbol}
            onChange={(e) => setDraftSymbol(e.target.value)}
            disabled={disabled}
            className="mt-1 px-3 py-2 border border-[var(--rule-default)] rounded text-sm font-mono w-32"
          />
        </div>
        <div>
          <label className="block text-[11px] text-[var(--ink-tertiary)]">threshold %</label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            max="50"
            value={draftThreshold}
            onChange={(e) => setDraftThreshold(e.target.value)}
            disabled={disabled}
            className="mt-1 px-3 py-2 border border-[var(--rule-default)] rounded text-sm font-mono w-24"
          />
        </div>
        <button
          type="button"
          onClick={addOverride}
          disabled={disabled}
          className="px-3 py-2 bg-[var(--accent-color)] text-white rounded text-sm disabled:opacity-50"
        >
          add
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
