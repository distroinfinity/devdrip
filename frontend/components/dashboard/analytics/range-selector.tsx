"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { cn } from "@devdrip/design-system/utils"

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const

interface RangeSelectorProps {
  activeDays: number
}

export function RangeSelector({ activeDays }: RangeSelectorProps) {
  const router = useRouter()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function setRange(days: number): void {
    const sp = new URLSearchParams(params.toString())
    const to = new Date()
    const from = new Date(to.getTime() - days * 86_400_000)
    sp.set("from", from.toISOString())
    sp.set("to", to.toISOString())
    startTransition(() => {
      router.push(`/dashboard/analytics?${sp.toString()}`)
    })
  }

  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex gap-1 rounded-pill border border-[var(--rule-default)] bg-[var(--bg-surface)] p-1 transition-opacity",
        isPending && "opacity-60"
      )}
    >
      {PRESETS.map((p) => (
        <button
          key={p.days}
          role="tab"
          aria-selected={activeDays === p.days}
          onClick={() => setRange(p.days)}
          className={cn(
            "rounded-pill px-3 py-1 font-display text-[10px] font-bold uppercase tracking-[0.12em] transition-colors",
            activeDays === p.days
              ? "bg-[var(--bg-inset)] text-[var(--ink-primary)]"
              : "text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
