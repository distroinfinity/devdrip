import Link from "next/link"
import { cn } from "@devdrip/design-system/utils"

interface NavPillProps {
  href: string
  label: string
  active?: boolean
  disabled?: boolean
  soonLabel?: string
}

// monochrome nav chips — accent color is reserved for surgical touchpoints
// (earnings number, chart line, links), not wide fills.
export function NavPill({ href, label, active, disabled, soonLabel }: NavPillProps) {
  const base =
    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-body text-[12px] font-medium transition-colors"

  const classes = cn(
    base,
    active && "border border-[var(--rule-strong)] bg-[var(--bg-surface)] text-[var(--ink-primary)]",
    !active &&
      !disabled &&
      "border border-transparent text-[var(--ink-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--ink-primary)]",
    disabled && "cursor-not-allowed border border-transparent text-[var(--ink-tertiary)] opacity-80"
  )

  if (disabled) {
    return (
      <span className={classes} title={soonLabel ?? "Coming soon"}>
        {label}
        {soonLabel && (
          <span className="font-display text-[9px] uppercase tracking-[0.1em] text-[var(--ink-faint)]">
            {soonLabel}
          </span>
        )}
      </span>
    )
  }

  return (
    <Link href={href} className={classes} aria-current={active ? "page" : undefined}>
      {label}
    </Link>
  )
}
