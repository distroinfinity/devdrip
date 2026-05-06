"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { cn } from "@distrotv/design-system/utils"

const SOURCES = ["", "direct", "carbon", "ethicalads", "google", "amazon", "x402"] as const
const RESULTS = ["", "completed", "skipped", "expired", "interrupted"] as const

const SOURCE_LABELS: Record<string, string> = {
  "": "All sources",
  direct: "Direct",
  carbon: "Carbon Ads",
  ethicalads: "Ethical Ads",
  google: "Google",
  amazon: "Amazon",
  x402: "x402",
}

const RESULT_LABELS: Record<string, string> = {
  "": "All outcomes",
  completed: "Completed",
  skipped: "Skipped",
  expired: "Expired",
  interrupted: "Interrupted",
}

interface HistoryFiltersProps {
  csvHref: string
}

export function HistoryFilters({ csvHref }: HistoryFiltersProps) {
  const router = useRouter()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const from = params.get("from") ?? ""
  const to = params.get("to") ?? ""
  const source = params.get("source") ?? ""
  const result = params.get("result") ?? ""

  function update(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(next)) {
      if (!v) sp.delete(k)
      else sp.set(k, v)
    }
    // changing filters resets the cursor — load-more state is in the URL too
    sp.delete("cursor")
    startTransition(() => {
      router.push(`/dashboard/history${sp.toString() ? `?${sp.toString()}` : ""}`)
    })
  }

  const hasFilters = Boolean(from || to || source || result)

  return (
    <section
      className={cn(
        "rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] px-4 py-3 transition-opacity",
        isPending && "opacity-60"
      )}
    >
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <FieldGroup label="From">
          <input
            type="date"
            value={from}
            onChange={(e) => update({ from: e.target.value })}
            className="filter-input"
          />
        </FieldGroup>

        <FieldGroup label="To">
          <input
            type="date"
            value={to}
            onChange={(e) => update({ to: e.target.value })}
            className="filter-input"
          />
        </FieldGroup>

        <FieldGroup label="Source">
          <select
            value={source}
            onChange={(e) => update({ source: e.target.value })}
            className="filter-input"
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </FieldGroup>

        <FieldGroup label="Outcome">
          <select
            value={result}
            onChange={(e) => update({ result: e.target.value })}
            className="filter-input"
          >
            {RESULTS.map((r) => (
              <option key={r} value={r}>
                {RESULT_LABELS[r]}
              </option>
            ))}
          </select>
        </FieldGroup>

        <div className="ml-auto flex items-center gap-2">
          {hasFilters && (
            <button
              type="button"
              onClick={() =>
                update({ from: undefined, to: undefined, source: undefined, result: undefined })
              }
              className="font-display text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]"
            >
              clear
            </button>
          )}
          <a
            href={csvHref}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--rule-default)] bg-[var(--bg-inset)] px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-secondary)] transition-colors hover:border-[var(--rule-strong)] hover:text-[var(--ink-primary)]"
          >
            ↓ csv
          </a>
        </div>
      </div>

      <style jsx>{`
        .filter-input {
          background: var(--bg-inset);
          border: 1px solid var(--rule-default);
          border-radius: 6px;
          padding: 6px 10px;
          font-family: var(--font-body);
          font-size: 12px;
          color: var(--ink-primary);
          color-scheme: light dark;
          min-width: 130px;
        }
        .filter-input:focus {
          outline: none;
          border-color: var(--accent-color);
        }
      `}</style>
    </section>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-display text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
        {label}
      </span>
      {children}
    </label>
  )
}
