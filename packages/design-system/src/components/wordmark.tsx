import { cn } from "../utils"

interface WordmarkProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

// "dev drip" in Space Mono, lowercase, tracking-tight — matches landing.
// size: sm (12px, footer), md (17px, header), lg (22px, hero placements).
export function Wordmark({ className, size = "md" }: WordmarkProps) {
  const sizeClass = size === "sm" ? "text-[12px]" : size === "lg" ? "text-[22px]" : "text-[17px]"

  return (
    <span
      className={cn(
        "font-display font-bold tracking-tight text-[var(--ink-primary)] select-none",
        sizeClass,
        className
      )}
    >
      dev drip
    </span>
  )
}
