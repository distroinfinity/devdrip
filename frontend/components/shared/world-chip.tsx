"use client"

import { cn } from "@/lib/utils"

interface WorldChipProps {
  className?: string
  href?: string
}

export function WorldChip({ className, href = "#built-on-world" }: WorldChipProps) {
  return (
    <a
      href={href}
      aria-label="Built on World Chain"
      className={cn(
        "group inline-flex items-center gap-1.5 h-7 pl-1.5 pr-2.5 rounded-full",
        "border border-[var(--ink-faint)] bg-[var(--bg-surface)]",
        "font-data text-[10px] tracking-[0.08em] uppercase text-[var(--ink-secondary)]",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-px hover:border-[var(--accent-color)] hover:text-[var(--ink-primary)]",
        "hover:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-color)_18%,transparent)]",
        className
      )}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center h-4 w-4 rounded-full",
          "bg-[var(--ink-primary)] text-[var(--ink-inverse)]",
          "transition-colors group-hover:bg-[var(--accent-color)]"
        )}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9.5" />
          <path d="M2.5 12h19" />
          <path d="M12 2.5c2.6 3 4 6.2 4 9.5s-1.4 6.5-4 9.5c-2.6-3-4-6.2-4-9.5s1.4-6.5 4-9.5z" />
        </svg>
      </span>
      <span>built on world</span>
    </a>
  )
}
