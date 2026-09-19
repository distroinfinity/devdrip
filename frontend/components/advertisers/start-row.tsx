import { cn } from "@/lib/utils"
import { BrandMark, type BrandMarkName } from "./brand-mark"

const OPTIONS: { label: string; when: string | null; mark: BrandMarkName | null }[] = [
  { label: "Connect Google Ads", when: "coming soon", mark: "googleAds" },
  { label: "Connect Meta Ads", when: "coming soon", mark: "meta" },
  { label: "Amazon Ads", when: "next", mark: "amazon" },
  { label: "Write one", when: null, mark: null },
]

// where an ad comes from. imports first; writing one is the only door open today.
export function StartRow() {
  return (
    <div>
      <div
        role="group"
        aria-label="Start from"
        className="grid grid-cols-2 gap-px border border-[var(--rule-default)] bg-[var(--rule-default)] md:grid-cols-4"
      >
        {OPTIONS.map((opt) => {
          const open = opt.when === null
          return (
            <button
              key={opt.label}
              type="button"
              disabled={!open}
              aria-disabled={!open}
              aria-pressed={open}
              className={cn(
                "flex min-h-[64px] flex-col items-start justify-center gap-0.5 rounded-none px-4 py-3 text-left font-body text-[14px]",
                open
                  ? "bg-[var(--ink-primary)] text-[var(--bg-primary)]"
                  : "cursor-not-allowed bg-[var(--bg-surface)] text-[var(--ink-secondary)]"
              )}
            >
              <span className="flex items-center gap-2">
                {opt.mark && (
                  <BrandMark name={opt.mark} size={16} className="shrink-0 opacity-70" />
                )}
                {opt.label}
              </span>
              {opt.when && (
                <span className="font-data text-[11px] text-[var(--ink-tertiary)]">{opt.when}</span>
              )}
            </button>
          )
        })}
      </div>
      <p className="m-0 mt-3 font-body text-[13px] text-[var(--ink-secondary)]">
        Imports are read-only. We copy the ad. We never touch your campaigns.
      </p>
    </div>
  )
}
