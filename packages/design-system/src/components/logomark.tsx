import { cn } from "../utils"

interface LogomarkProps {
  className?: string
  size?: number
}

// matches the landing page mark: dark rounded square with an inverse
// "bookmark" cutout. size drives the overall pixel dimensions.
export function Logomark({ className, size = 28 }: LogomarkProps) {
  const inner = { width: Math.round(size * 0.215), height: Math.round(size * 0.36) }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-[5px] bg-[var(--ink-primary)]",
        className
      )}
      style={{ width: size, height: size }}
    >
      <div className="rounded-b-sm bg-[var(--ink-inverse)] opacity-90" style={inner} />
    </div>
  )
}
