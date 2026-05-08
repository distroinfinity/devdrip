import { cn } from "@/lib/utils"

interface Option<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  options: Option<T>[]
  value: T
  onChange: (next: T) => void
  disabled?: boolean
}

export function SegmentedPill<T extends string>({ options, value, onChange, disabled }: Props<T>) {
  return (
    <div
      className={cn(
        "inline-flex border border-[var(--rule-default)] bg-[var(--bg-surface)]",
        "font-[var(--font-display)] text-[10px] font-bold tracking-[0.08em]"
      )}
    >
      {options.map((opt, i) => {
        const on = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-1.5 transition-colors duration-150",
              on
                ? "bg-[var(--ink-primary)] text-[var(--bg-primary)]"
                : "text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]",
              i < options.length - 1 && "border-r border-[var(--rule-default)]",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
