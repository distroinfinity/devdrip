import { formatInt } from "@/lib/format"

interface FooterStripProps {
  totalImpressions: number
  totalClicks: number
  updatedAt: string
}

export function FooterStrip({ totalImpressions, totalClicks, updatedAt }: FooterStripProps) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-[11px] text-[var(--ink-tertiary)]">
      <span>
        <span className="font-data tabular-nums">{formatInt(totalImpressions)}</span> impressions
      </span>
      <span aria-hidden>·</span>
      <span>
        <span className="font-data tabular-nums">{formatInt(totalClicks)}</span> clicks
      </span>
      <span aria-hidden>·</span>
      <span>data refreshes every minute · last update {updatedAt}</span>
    </p>
  )
}
