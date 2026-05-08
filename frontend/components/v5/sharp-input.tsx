import type { InputHTMLAttributes } from "react"
import { forwardRef } from "react"
import { cn } from "@/lib/utils"

export const SharpInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input
      ref={ref}
      {...rest}
      className={cn(
        "px-3 py-2 text-[13px] font-[var(--font-body)]",
        "bg-[var(--bg-surface)] text-[var(--ink-primary)]",
        "border border-[var(--rule-default)] rounded-none",
        "focus:outline-none focus:border-[var(--accent-color)]",
        "placeholder:text-[var(--ink-tertiary)]",
        "disabled:opacity-50",
        className
      )}
    />
  )
)
SharpInput.displayName = "SharpInput"
