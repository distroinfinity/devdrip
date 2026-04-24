import { DotGrid } from "@devdrip/design-system/components/dot-grid"

export function EmptyAnalytics() {
  return (
    <section className="relative overflow-hidden rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] px-6 py-10 text-center md:px-10 md:py-14">
      <DotGrid spacing={16} opacity={0.18} />
      <div className="relative mx-auto max-w-[440px]">
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
          Nothing to chart
        </p>
        <h2 className="mt-3 font-display text-[22px] font-bold leading-[1.2] tracking-[-0.01em] text-[var(--ink-primary)]">
          Once impressions land, the charts wake up.
        </h2>
        <p className="mt-3 font-body text-[13px] leading-[1.55] text-[var(--ink-secondary)]">
          Install the CLI, pair it once with <code className="font-data">devdrip auth</code>, and
          use Claude Code as you normally would.
        </p>
      </div>
    </section>
  )
}
