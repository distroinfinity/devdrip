"use client"

import { useState } from "react"
import { ReadingRow } from "./reading-row"
import { deleteReadingItem } from "@/app/dashboard/actions"
import type { ReadingItem } from "@/lib/dashboard-api"

interface ReadingListProps {
  initialItems: ReadingItem[]
  hasMore: boolean
}

export function ReadingList({ initialItems, hasMore }: ReadingListProps) {
  const [items, setItems] = useState<ReadingItem[]>(initialItems)
  const [error, setError] = useState<string | null>(null)

  async function remove(id: string): Promise<void> {
    const prev = items
    setItems((cur) => cur.filter((i) => i.id !== id))
    setError(null)
    const result = await deleteReadingItem(id)
    if (!result.ok) {
      setItems(prev)
      setError(result.error ?? "couldn't remove — try again")
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--ink-tertiary)]/15 p-8 text-center">
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
    <div>
      <div className="flex flex-col divide-y divide-[var(--ink-tertiary)]/15 rounded-xl border border-[var(--ink-tertiary)]/15">
        {items.map((item) => (
          <ReadingRow key={item.id} item={item} onRemove={remove} />
        ))}
      </div>
      {hasMore ? (
        <p className="mt-3 font-body text-[12px] text-[var(--ink-tertiary)]">
          showing newest 100 — pagination coming in v1.1.
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 font-body text-[12px] text-[var(--status-negative)]">{error}</p>
      ) : null}
    </div>
  )
}
