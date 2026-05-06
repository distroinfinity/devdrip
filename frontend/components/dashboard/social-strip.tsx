import { IconX } from "@distrotv/design-system/components/icon-x"
import { cn } from "@distrotv/design-system/utils"

interface SocialStripProps {
  className?: string
  variant?: "header" | "footer"
}

// X social link — same affordance as landing header and footer
export function SocialStrip({ className, variant = "header" }: SocialStripProps) {
  const isHeader = variant === "header"
  return (
    <a
      href="https://x.com/devdripdotxyz"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="X (Twitter)"
      className={cn(
        "inline-flex items-center text-[var(--ink-secondary)] transition-colors hover:text-[var(--ink-primary)]",
        isHeader && "px-3 py-1.5 rounded-md hover:bg-[var(--bg-surface-hover)]",
        className
      )}
    >
      <IconX size={isHeader ? 14 : 14} />
    </a>
  )
}
