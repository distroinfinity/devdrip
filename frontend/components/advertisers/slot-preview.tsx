import { cn } from "@/lib/utils"

const PLACEHOLDER_BRAND = "Your brand"
const PLACEHOLDER_LINE = "One line of copy, in front of a developer waiting on their agent."
// every click goes through our short redirect, so this is what the viewer sees
const SAMPLE_CLICK_URL = "https://api.distrotv.xyz/c/3f0c2f0e7f1a"

// the cli panel, row for row: bar on every row, filled AD badge, bold brand.
// the right side of row one stays empty here — that figure is the viewer's, not the advertiser's.
export function SlotPreview({
  brand,
  line,
  className,
}: {
  brand: string
  line: string
  className?: string
}) {
  const hasBrand = brand.trim().length > 0
  const hasLine = line.trim().length > 0

  return (
    <figure className={cn("m-0", className)}>
      <div className="border border-[var(--rule-strong)] bg-[#0A0A0C] font-data text-[12px] leading-[1.5] text-[#EDEDF0] shadow-[0_12px_32px_rgba(14,14,17,0.12)]">
        <div className="flex items-center gap-1.5 border-b border-[#1E1E22] px-3 py-2 text-[10px] text-[#8A8A94]">
          <span className="h-2 w-2 rounded-full border border-[#3A3A40]" />
          <span className="h-2 w-2 rounded-full border border-[#3A3A40]" />
          <span className="h-2 w-2 rounded-full border border-[#3A3A40]" />
          <span className="ml-2">status line</span>
        </div>

        <div aria-hidden="true" className="px-4 pt-3 text-[#5C5C66]">
          <div className="truncate">Bash · pnpm test</div>
          <div>working…</div>
        </div>

        <div className="px-4 py-3">
          <div className="border-l-2 border-[#6366F1] pl-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 bg-[#6366F1] px-1 text-[9px] font-bold leading-[1.5] text-[#0A0A0C]">
                AD
              </span>
              <span className={cn("min-w-0 break-words font-bold", !hasBrand && "text-[#5C5C66]")}>
                {hasBrand ? brand : PLACEHOLDER_BRAND}
              </span>
            </div>
            <div className={cn("mt-0.5 break-words", !hasLine && "text-[#5C5C66]")}>
              {hasLine ? line : PLACEHOLDER_LINE}
            </div>
            <div className="mt-0.5 text-[11px]">
              <span className="break-all text-[#818CF8]">↗ {SAMPLE_CLICK_URL}</span>
              <span className="ml-2 whitespace-nowrap text-[#5C5C66]">⌘ click</span>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-2 font-body text-[13px] text-[var(--ink-secondary)]">
        How it looks in the terminal. Clicks go through a short Distro TV link to yours.
      </figcaption>
    </figure>
  )
}
