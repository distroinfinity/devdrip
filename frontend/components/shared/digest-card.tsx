import { cn } from "@/lib/utils"
import { DotGrid } from "./dot-grid"

interface DigestItem {
  tag: string
  title: string
  sponsor: string
}

interface DigestCardProps {
  greeting?: string
  yesterdayEarnings?: string
  items?: DigestItem[]
  className?: string
}

const defaultItems: DigestItem[] = [
  {
    tag: "INFRA",
    title: "Turso launched edge replication",
    sponsor: "Turso",
  },
  {
    tag: "TIP",
    title: "git worktree lets you checkout multiple branches",
    sponsor: "GitKraken",
  },
  {
    tag: "ROLE",
    title: "Staff Engineer @ Stripe (Remote)",
    sponsor: "Stripe",
  },
]

export function DigestCard({
  greeting = "Good Morning",
  yesterdayEarnings = "+$1.24",
  items = defaultItems,
  className,
}: DigestCardProps) {
  return (
    <div
      className={cn(
        "bg-[var(--bg-surface)] border border-[var(--rule-default)] rounded-lg p-5 relative overflow-hidden",
        className
      )}
    >
      <DotGrid opacity={0.15} />
      <div className="relative">
        {/* header */}
        <div className="font-display text-[13px] font-bold text-[var(--ink-primary)] mb-3">
          {greeting}
        </div>

        {/* yesterday earnings */}
        <div className="flex justify-between items-baseline mb-3.5">
          <span className="font-body text-caption text-[var(--ink-tertiary)]">Yesterday</span>
          <span className="font-data text-[16px] font-bold text-[var(--ink-primary)]">
            {yesterdayEarnings}
          </span>
        </div>

        <div className="h-px bg-[var(--rule-subtle)] mb-3" />

        {/* content items */}
        {items.map((item, i) => (
          <div
            key={i}
            className={cn(
              "py-2 flex gap-2.5 items-start",
              i < items.length - 1 && "border-b border-[var(--rule-subtle)]"
            )}
          >
            <span className="font-body text-[9px] font-semibold tracking-[0.06em] bg-[var(--bg-inset)] text-[var(--ink-tertiary)] px-1.5 py-0.5 rounded-[3px] shrink-0 mt-0.5">
              {item.tag}
            </span>
            <div>
              <div className="font-body text-[13px] font-medium text-[var(--ink-primary)] leading-snug">
                {item.title}
              </div>
              <div className="font-body text-[11px] text-[var(--ink-tertiary)] mt-0.5">
                Sponsored by {item.sponsor}
              </div>
            </div>
          </div>
        ))}

        {/* action links */}
        <div className="flex gap-2.5 mt-3">
          {["Dismiss", "Show fewer", "Customize"].map((action, i) => (
            <span
              key={action}
              className={cn(
                "font-body text-[11px] font-medium cursor-pointer",
                i === 0
                  ? "text-[var(--ink-primary)] border-b border-[var(--rule-strong)] pb-px"
                  : "text-[var(--ink-tertiary)]"
              )}
            >
              {action}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
