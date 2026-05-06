"use client"

import { cn } from "@distrotv/design-system/utils"
import { CATEGORY_SLUGS, categoryLabel } from "@/lib/categories"

interface BlockedCategoriesGridProps {
  blocked: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}

export function BlockedCategoriesGrid({ blocked, onChange, disabled }: BlockedCategoriesGridProps) {
  function toggle(cat: string): void {
    if (disabled) return
    const set = new Set(blocked)
    if (set.has(cat)) set.delete(cat)
    else set.add(cat)
    onChange([...set])
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {CATEGORY_SLUGS.map((cat) => {
        const active = blocked.includes(cat)
        return (
          <button
            key={cat}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => toggle(cat)}
            className={cn(
              "group flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition-all",
              active
                ? "border-[var(--accent-color)] bg-[var(--accent-glow)] shadow-[0_0_0_3px_var(--accent-glow)]"
                : "border-[var(--rule-default)] bg-[var(--bg-inset)] hover:border-[var(--rule-strong)]"
            )}
          >
            <span
              className={cn(
                "font-body text-[13px]",
                active ? "text-[var(--accent-color)]" : "text-[var(--ink-primary)]"
              )}
            >
              {categoryLabel(cat)}
            </span>
            <span
              className={cn(
                "font-display text-[9px] font-bold uppercase tracking-[0.12em]",
                active ? "text-[var(--accent-color)]" : "text-[var(--ink-tertiary)]"
              )}
            >
              {active ? "blocked" : "allow"}
            </span>
          </button>
        )
      })}
    </div>
  )
}
