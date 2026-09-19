import { formatInt } from "@/lib/format"

interface CtrTileProps {
  clicks: number
  completed: number
  earned: number
  impressions: number
}

export function CtrTile({ clicks, completed, earned, impressions }: CtrTileProps) {
  const ctr = completed > 0 ? (clicks / completed) * 100 : 0

  return (
    <section className="flex flex-col justify-between rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] px-4 py-5 md:px-6">
      <div>
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
          Discovery rate
        </p>
        <p className="mt-3 font-data text-[40px] font-bold tabular-nums leading-[1] text-[var(--ink-primary)] md:text-[48px]">
          {ctr.toFixed(1)}
          <span className="font-data text-[18px] text-[var(--ink-tertiary)]">%</span>
        </p>
        <p className="mt-2 font-body text-[11px] text-[var(--ink-tertiary)]">
          {formatInt(clicks)} clicks on {formatInt(completed)} completed impressions
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--rule-subtle)] pt-3">
        <div>
          <p className="font-display text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--ink-tertiary)]">
            Total
          </p>
          <p className="mt-0.5 font-data text-[14px] tabular-nums text-[var(--ink-primary)]">
            {formatInt(impressions)}
          </p>
        </div>
        <div>
          <p className="font-display text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--ink-tertiary)]">
            Earned
          </p>
          <p className="mt-0.5 font-data text-[14px] tabular-nums text-[var(--ink-primary)]">
            ${earned.toFixed(2)}
          </p>
        </div>
      </div>
    </section>
  )
}
