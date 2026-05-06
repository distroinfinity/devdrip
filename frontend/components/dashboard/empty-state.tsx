import { DotGrid } from "@distrotv/design-system/components/dot-grid"

export function EmptyEarnings() {
  return (
    <section className="relative overflow-hidden rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] px-6 py-10 text-center md:px-10 md:py-14">
      <DotGrid spacing={16} opacity={0.18} />
      <div className="relative mx-auto max-w-[440px]">
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
          Nothing earned yet
        </p>
        <h2 className="mt-3 font-display text-[22px] font-bold leading-[1.2] tracking-[-0.01em] text-[var(--ink-primary)]">
          Install the CLI and let your agent pay you back.
        </h2>
        <p className="mt-3 font-body text-[13px] leading-[1.55] text-[var(--ink-secondary)]">
          Dev Drip runs while Claude Code is thinking. Every impression trickles USDC into your
          balance. Nothing ships without the CLI running.
        </p>

        <pre className="mx-auto mt-5 inline-block rounded-md border border-[var(--rule-default)] bg-[var(--bg-inset)] px-4 py-3 text-left">
          <code className="font-data text-[12px] text-[var(--ink-primary)]">
            npm i -g @distrotv/cli
            {"\n"}devdrip auth
          </code>
        </pre>
      </div>
    </section>
  )
}
