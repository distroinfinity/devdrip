import { cn } from "../utils"

interface VersionBadgeProps {
  version?: string
  className?: string
}

export function VersionBadge({ version = "v0.1", className }: VersionBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[3px] border border-[var(--accent-color)] px-1.5 py-0.5 font-data text-[9px] font-medium tracking-[0.06em] text-[var(--accent-color)]",
        className
      )}
    >
      {version}
    </span>
  )
}
