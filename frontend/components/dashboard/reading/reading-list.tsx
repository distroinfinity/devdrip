"use client"

import { useState } from "react"
import { NewsRow, type NewsRowData } from "@/components/dashboard/overview/news-row"
import { EmptyState } from "@/components/v5/empty-state"
import { deleteReadingItem } from "@/app/dashboard/actions"
import type { ReadingItem } from "@/lib/dashboard-api"

interface ReadingListProps {
  initialItems: ReadingItem[]
  hasMore: boolean
}

// map ReadingItem to the shape NewsRow expects
function toNewsRowData(item: ReadingItem): NewsRowData {
  return {
    id: item.id,
    title: item.headline,
    url: item.url,
    source: item.source,
    score: item.score ?? null,
    comments: null,
    createdAt: item.savedAt,
  }
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
      <EmptyState
        title="no saved items"
        body="hit [s] on a news slot in your terminal to save one"
      />
    )
  }

  return (
    <div>
      <div className="flex flex-col">
        {items.map((item, idx) => (
          <div key={item.id} className="group">
            <NewsRow
              item={toNewsRowData(item)}
              index={idx}
              actions={
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  aria-label={`remove ${item.headline}`}
                  className="font-[var(--font-data)] text-[10px] text-[var(--ink-tertiary)] border border-[var(--rule-default)] px-2 py-0.5 opacity-0 group-hover:opacity-100 hover:border-[var(--color-oxblood,#C13438)] hover:text-[var(--color-oxblood,#C13438)] transition-all whitespace-nowrap"
                >
                  remove
                </button>
              }
            />
          </div>
        ))}
      </div>
      {hasMore ? (
        <p className="mt-3 font-[var(--font-data)] text-[12px] text-[var(--ink-tertiary)]">
          showing newest 100 — pagination coming in v1.1
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 font-[var(--font-data)] text-[12px] text-[var(--color-oxblood,#C13438)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
