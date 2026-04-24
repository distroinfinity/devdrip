import { DotGrid } from "@devdrip/design-system/components/dot-grid"

interface EmptyHistoryProps {
  filtered: boolean
}

export function EmptyHistory({ filtered }: EmptyHistoryProps) {
  if (filtered) {
    return (
      <section className="relative overflow-hidden rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] px-6 py-10 text-center">
        <DotGrid spacing={16} opacity={0.18} />
        <div className="relative">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
            No matches
          </p>
          <h2 className="mt-2 font-body text-[14px] text-[var(--ink-secondary)]">
            no impressions match these filters. try widening the date range or clearing a filter.
          </h2>
        </div>
      </section>
    )
  }

  return (
    <section className="relative overflow-hidden rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] px-6 py-10 text-center md:px-10 md:py-14">
      <DotGrid spacing={16} opacity={0.18} />
      <div className="relative mx-auto max-w-[440px]">
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
          No history yet
        </p>
        <h2 className="mt-3 font-display text-[22px] font-bold leading-[1.2] tracking-[-0.01em] text-[var(--ink-primary)]">
          Once an ad shows, it lands here.
        </h2>
        <p className="mt-3 font-body text-[13px] leading-[1.55] text-[var(--ink-secondary)]">
          Install the CLI, run Claude Code, and we&apos;ll log every impression — what showed, when,
          what you earned.
        </p>
        <pre className="mx-auto mt-5 inline-block rounded-md border border-[var(--rule-default)] bg-[var(--bg-inset)] px-4 py-3 text-left">
          <code className="font-data text-[12px] text-[var(--ink-primary)]">
            npm i -g @devdrip/cli
            {"\n"}devdrip auth
          </code>
        </pre>
      </div>
    </section>
  )
}
