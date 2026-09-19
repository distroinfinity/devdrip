"use client"

import { useState, useTransition } from "react"
import { DEFAULT_FEEDS, FEEDS, type Feed } from "@distrotv/shared"
import { cn } from "@distrotv/design-system/utils"
import { savePreferences } from "@/app/dashboard/preferences/actions"

const FEED_COPY: Record<Feed, { label: string; hint: string }> = {
  ads: { label: "Ads", hint: "sponsored slots · you earn a share of each ad you see" },
  news: { label: "News", hint: "headlines from your channels" },
  markets: { label: "Markets", hint: "watchlist prices and movers" },
}

export function FeedsRow({ initial }: { initial?: Feed[] }) {
  const [feeds, setFeeds] = useState<Feed[]>(initial ?? DEFAULT_FEEDS)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle(feed: Feed): void {
    if (pending) return
    const prev = feeds
    // rebuild from FEEDS so the saved order stays canonical
    const next = FEEDS.filter((f) => (f === feed ? !prev.includes(f) : prev.includes(f)))
    setFeeds(next)
    setError(null)
    startTransition(async () => {
      const result = await savePreferences({ enabledFeeds: next })
      if (result.ok && result.preferences) {
        setFeeds(result.preferences.enabledFeeds ?? next)
      } else {
        setFeeds(prev)
        setError(result.error ?? "save failed")
      }
    })
  }

  const adsOff = !feeds.includes("ads")

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {FEEDS.map((feed) => {
          const on = feeds.includes(feed)
          const copy = FEED_COPY[feed]
          return (
            <button
              key={feed}
              type="button"
              role="switch"
              aria-checked={on}
              onClick={() => toggle(feed)}
              disabled={pending}
              className={cn(
                "flex items-start gap-3 rounded-none border px-3 py-3 text-left transition-colors",
                on
                  ? "border-[var(--accent-color)] bg-[var(--accent-surface)]"
                  : "border-[var(--rule-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]",
                pending && "cursor-wait opacity-60"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-none border",
                  on
                    ? "border-[var(--accent-color)] bg-[var(--accent-color)]"
                    : "border-[var(--rule-default)]"
                )}
              >
                {on && (
                  <svg
                    className="h-3 w-3 text-white"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M2 6.5L5 9.5 10 3.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="min-w-0">
                <span className="block font-body text-[13px] text-[var(--ink-primary)]">
                  {copy.label}
                </span>
                <span className="mt-0.5 block font-body text-[11px] leading-[1.45] text-[var(--ink-tertiary)]">
                  {copy.hint}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-3 min-h-[18px] font-body text-[12px]" aria-live="polite">
        {error ? (
          <p className="text-[var(--status-negative)]">
            save failed: {error} — your feeds were not changed.
          </p>
        ) : adsOff ? (
          <p className="text-[var(--ink-secondary)]">
            ads are off — you earn nothing while they&apos;re off.
            {feeds.length === 0 && " every feed is off, so nothing plays in your terminal."}
          </p>
        ) : (
          <p className="text-[var(--ink-tertiary)]">
            saved as you toggle. cli picks up changes within 30 min.
          </p>
        )}
      </div>
    </div>
  )
}
