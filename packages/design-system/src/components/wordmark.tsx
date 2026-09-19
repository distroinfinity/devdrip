import { cn } from "../utils"

interface WordmarkProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

// "distro·tv" in JetBrains Mono, uppercase tracking, indigo `·` separator.
// size: sm (12px, footer), md (14px, header), lg (28px, OG cards).
export function Wordmark({ className, size = "md" }: WordmarkProps) {
  const sizeClass = size === "sm" ? "text-[12px]" : size === "lg" ? "text-[28px]" : "text-[14px]"

  return (
    <span
      className={cn(
        "font-data font-bold uppercase tracking-[0.06em] text-[var(--ink-primary)] select-none",
        sizeClass,
        className
      )}
    >
      distro<span className="text-[var(--accent-color)] mx-[0.15em]">·</span>tv
    </span>
  )
}
