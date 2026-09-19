"use client"

import { cn } from "@/lib/utils"

export type TabId = "news" | "watchlist" | "alerts" | "all"

interface Tab {
  id: TabId
  label: string
  count?: number
}

interface Props {
  active: TabId
  tabs: Tab[]
  onChange: (id: TabId) => void
}

export function FeedTabs({ active, tabs, onChange }: Props) {
  return (
    <div className="flex items-center justify-between px-8 border-b border-[var(--rule-default)]">
      <div className="flex">
        {tabs.map((tab) => {
          const on = tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "font-[var(--font-display)] text-[11px] font-bold tracking-[0.06em] uppercase",
                "px-[18px] py-[14px] inline-flex items-center gap-2",
                "border-b-2 mb-[-1px] cursor-pointer transition-colors duration-150",
                on
                  ? "text-[var(--ink-primary)] border-[var(--accent-color)]"
                  : "text-[var(--ink-tertiary)] border-transparent hover:text-[var(--ink-primary)]"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className="font-[var(--font-data)] text-[9px] px-[5px] py-[1px]"
                  style={{
                    background: on ? "var(--accent-color)" : "var(--bg-secondary)",
                    color: on ? "white" : "var(--ink-tertiary)",
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="font-[var(--font-data)] text-[10px] text-[var(--ink-tertiary)] flex items-center gap-4">
        <span>↹ tab to switch</span>
      </div>
    </div>
  )
}
