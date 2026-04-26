export function LearnModeNotice() {
  return (
    <div className="rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] px-6 py-5">
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
        Earnings
      </p>
      <p className="mt-2 font-body text-[14px] text-[var(--ink-secondary)]">
        you're in <strong>learn mode</strong> — news only, no ads, no earnings.
      </p>
      <p className="mt-3 font-body text-[13px] text-[var(--ink-tertiary)]">
        switch to <strong>both</strong> in the header to alternate news and ads, and start earning
        USDC alongside your reading.
      </p>
    </div>
  )
}
