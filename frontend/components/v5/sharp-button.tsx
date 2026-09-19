import type { ButtonHTMLAttributes } from "react"
import { forwardRef } from "react"
import { cn } from "@/lib/utils"

type Variant = "primary" | "secondary" | "ghost"

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[var(--ink-primary)] text-[var(--bg-primary)] hover:bg-[var(--em-hover)] disabled:opacity-50",
  secondary:
    "bg-[var(--bg-surface)] text-[var(--ink-primary)] border border-[var(--rule-default)] hover:border-[var(--rule-strong)] disabled:opacity-50",
  ghost:
    "bg-transparent text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-50",
}

export const SharpButton = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", className, ...rest }, ref) => (
    <button
      ref={ref}
      {...rest}
      className={cn(
        "px-4 py-2 text-[13px] font-medium font-[var(--font-body)] transition-colors duration-150 rounded-none",
        variantClasses[variant],
        className
      )}
    />
  )
)
SharpButton.displayName = "SharpButton"
