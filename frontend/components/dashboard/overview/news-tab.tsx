"use client"

import { NewsRow, type NewsRowData } from "./news-row"
import { EmptyState } from "@/components/v5/empty-state"

interface Props {
  items: NewsRowData[]
}

export function NewsTab({ items }: Props) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="no news yet"
        body="articles appear here after your CLI renders them. start the distro daemon and let it run."
      />
    )
  }

  return (
    <div className="pb-7">
      {items.map((item, i) => (
        <NewsRow
          key={item.id}
          item={item}
          index={i}
          actions={
            <>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-[7px] py-[3px] border border-[var(--rule-default)] text-[var(--ink-tertiary)] font-[var(--font-data)] text-[10px] cursor-pointer hover:text-[var(--ink-primary)] hover:border-[var(--ink-primary)] no-underline transition-colors"
              >
                open
              </a>
            </>
          }
        />
      ))}
    </div>
  )
}
