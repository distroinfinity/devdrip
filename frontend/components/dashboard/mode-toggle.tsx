"use client"

import { useState, useTransition } from "react"
import { ChannelMode } from "@devdrip/shared"
import { putPreferences } from "@/lib/dashboard-api"

const OPTIONS: { value: ChannelMode; label: string; emoji: string }[] = [
  { value: ChannelMode.Learn, label: "learn", emoji: "📰" },
  { value: ChannelMode.Earn, label: "earn", emoji: "💰" },
  { value: ChannelMode.Mix, label: "both", emoji: "🎭" },
]

export function ModeToggle({ initial }: { initial: ChannelMode }) {
  const [active, setActive] = useState<ChannelMode>(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function pick(next: ChannelMode): void {
    if (next === active || pending) return
    const prev = active
    setActive(next)
    setError(null)
    startTransition(async () => {
      try {
        await putPreferences({ channelMode: next })
      } catch {
        setActive(prev)
        setError("couldn't update mode")
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div
        role="radiogroup"
        aria-label="channel mode"
        className="inline-flex items-center rounded-full border border-[var(--rule-default)] bg-[var(--bg-elevated)]/80 p-1 backdrop-blur"
      >
        {OPTIONS.map((opt) => {
          const selected = opt.value === active
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={pending}
              onClick={() => pick(opt.value)}
              className={[
                "h-8 px-3 rounded-full font-display text-[11px] tracking-wide transition-colors disabled:opacity-60",
                selected
                  ? "bg-[var(--ink-primary)] text-[var(--bg-primary)]"
                  : "text-[var(--ink-secondary)] hover:bg-[var(--ink-tertiary)]/10",
              ].join(" ")}
            >
              <span className="mr-1">{opt.emoji}</span>
              {opt.label}
            </button>
          )
        })}
      </div>
      {error ? (
        <span className="font-body text-[10px] text-[var(--status-negative)]">{error}</span>
      ) : null}
    </div>
  )
}
