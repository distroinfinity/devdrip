"use client"

import { useRef, useState, useTransition } from "react"
import type { ChannelMode } from "@distrotv/shared"
import { updateChannelMode } from "@/app/dashboard/actions"

// string literals match the ChannelMode enum values in @distrotv/shared
// (kept inline to avoid bundling shared's node:path import into the client)
const OPTIONS: { value: ChannelMode; label: string; emoji: string }[] = [
  { value: "news_only" as ChannelMode, label: "news", emoji: "📰" },
  { value: "ticker_only" as ChannelMode, label: "ticker", emoji: "💰" },
  { value: "balanced" as ChannelMode, label: "both", emoji: "🎭" },
]

export function ModeToggle({ initial }: { initial: ChannelMode }) {
  const [active, setActive] = useState<ChannelMode>(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  function pick(next: ChannelMode): void {
    if (next === active || pending) return
    const prev = active
    setActive(next)
    setError(null)
    startTransition(async () => {
      const result = await updateChannelMode(next)
      if (!result.ok) {
        setActive(prev)
        setError(result.error ?? "couldn't update mode")
      }
    })
  }

  function focusOption(idx: number): void {
    const next = OPTIONS[idx]
    if (!next) return
    pick(next.value)
    buttonRefs.current[idx]?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent, currentIdx: number): void {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault()
      focusOption((currentIdx + 1) % OPTIONS.length)
      return
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault()
      focusOption((currentIdx - 1 + OPTIONS.length) % OPTIONS.length)
      return
    }
    if (e.key === "Home") {
      e.preventDefault()
      focusOption(0)
      return
    }
    if (e.key === "End") {
      e.preventDefault()
      focusOption(OPTIONS.length - 1)
      return
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div
        role="radiogroup"
        aria-label="channel mode"
        className="inline-flex items-center rounded-full border border-[var(--rule-default)] bg-[var(--bg-elevated)]/80 p-1 backdrop-blur"
      >
        {OPTIONS.map((opt, idx) => {
          const selected = opt.value === active
          return (
            <button
              key={opt.value}
              ref={(el) => {
                buttonRefs.current[idx] = el
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              disabled={pending}
              onClick={() => pick(opt.value)}
              onKeyDown={(e) => onKeyDown(e, idx)}
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
