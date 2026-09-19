import { cn } from "../utils"

// 9x9 pixel heart rendered on a 1px grid — matches landing footer.
export function HeartPixel({ className }: { className?: string }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="currentColor"
      className={cn("inline-block -mt-px text-[var(--ink-tertiary)]", className)}
      role="img"
      aria-label="love"
    >
      <rect x="1" y="0" width="2" height="1" />
      <rect x="6" y="0" width="2" height="1" />
      <rect x="0" y="1" width="4" height="1" />
      <rect x="5" y="1" width="4" height="1" />
      <rect x="0" y="2" width="9" height="1" />
      <rect x="0" y="3" width="9" height="1" />
      <rect x="1" y="4" width="7" height="1" />
      <rect x="2" y="5" width="5" height="1" />
      <rect x="3" y="6" width="3" height="1" />
      <rect x="4" y="7" width="1" height="1" />
    </svg>
  )
}
