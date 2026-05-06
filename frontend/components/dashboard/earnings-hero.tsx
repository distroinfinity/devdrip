import { BlurFade } from "@distrotv/design-system/components/blur-fade"
import { DotGrid } from "@distrotv/design-system/components/dot-grid"
import { formatUsd } from "@/lib/format"

interface EarningsHeroProps {
  balance: number
  streakDays: number
}

export function EarningsHero({ balance, streakDays }: EarningsHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] px-6 py-7 md:px-8 md:py-9">
      <DotGrid spacing={16} opacity={0.2} />

      <div className="relative flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
            Balance
          </p>
          <BlurFade delay={0.05} direction="up" offset={8}>
            <h1 className="mt-2 font-data text-[48px] font-bold leading-[1.05] tabular-nums text-[var(--ink-primary)] md:text-[64px]">
              {formatUsd(balance)}
            </h1>
          </BlurFade>
          <p className="mt-2 font-body text-[13px] text-[var(--ink-secondary)]">
            Available to claim.{" "}
            <span className="text-[var(--ink-tertiary)]">Cleared earnings only.</span>
          </p>
        </div>

        {streakDays > 0 && (
          <div className="inline-flex items-center gap-2 self-start rounded-pill border border-[var(--rule-default)] bg-[var(--bg-inset)]/60 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-color)]" aria-hidden />
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-secondary)]">
              {streakDays}-Day Streak
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
