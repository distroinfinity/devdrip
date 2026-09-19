import Link from "next/link"
import type { ReadingItem } from "@/lib/dashboard-api"

interface SavedStoriesPreviewProps {
  items: ReadingItem[]
}

function formatSavedAt(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return "just now"
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return "just now"
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

export function SavedStoriesPreview({ items }: SavedStoriesPreviewProps) {
  const top = items.slice(0, 3)

  if (top.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] px-6 py-8 text-center">
        <p className="font-body text-[14px] text-[var(--ink-secondary)]">
          nothing saved yet — press{" "}
          <kbd className="rounded bg-[var(--ink-tertiary)]/10 px-1.5 py-0.5 font-mono text-[12px]">
            b
          </kbd>{" "}
          while a news headline is up to save it.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--rule-subtle)] px-6 py-4">
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
          Recent saves
        </p>
        <Link
          href="/dashboard/reading"
          className="font-display text-[11px] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
        >
          see all →
        </Link>
      </div>
      <ul className="divide-y divide-[var(--rule-subtle)]">
        {top.map((item) => (
          <li key={item.id} className="px-6 py-3">
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
          </li>
        ))}
      </ul>
    </div>
  )
}
