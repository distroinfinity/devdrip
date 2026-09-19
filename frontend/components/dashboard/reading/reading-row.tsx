"use client"

import type { ReadingItem } from "@/lib/dashboard-api"

function formatSavedAt(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return "just now"
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return "just now"
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

interface ReadingRowProps {
  item: ReadingItem
  onRemove: (id: string) => void
}

export function ReadingRow({ item, onRemove }: ReadingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate font-body text-[14px] text-[var(--ink-primary)] hover:underline"
        >
          {item.headline}
        </a>
        <p className="mt-1 font-body text-[12px] text-[var(--ink-tertiary)]">
          {item.source} · {item.score} pts · saved {formatSavedAt(item.savedAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-[var(--ink-tertiary)]/20 px-3 py-1 font-display text-[11px] text-[var(--ink-secondary)] hover:border-[var(--ink-primary)]"
        >
          ↗ open
        </a>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`delete ${item.headline}`}
          className="rounded-full border border-[var(--ink-tertiary)]/20 px-2 py-1 font-display text-[11px] text-[var(--ink-secondary)] hover:border-[var(--status-negative)] hover:text-[var(--status-negative)]"
        >
          ×
        </button>
      </div>
    </div>
  )
}
