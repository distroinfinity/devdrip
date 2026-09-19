import { SharpButton } from "@/components/v5/sharp-button"
import type { EarningsSummary } from "@/lib/dashboard-api"
import { LiveAmount } from "./live-amount"
import { LiveRefresh } from "./live-refresh"

function formatCpm(rate: number): string {
  return Number.isInteger(rate) ? String(rate) : rate.toFixed(2)
}

export function EarningsHero({ summary }: { summary: EarningsSummary }) {
  const sharePct = Math.round(summary.revenueShare * 100)

  return (
    <div>
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
        Revenue
      </p>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="font-display text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--ink-primary)] md:text-[40px]">
          estimated earnings
        </h1>
        <LiveRefresh lastSeenAt={summary.lastSeenAt} />
      </div>

      <div className="mt-6 flex flex-col gap-6 border-y border-[var(--rule-default)] py-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <LiveAmount value={summary.allTime} />
          <p className="mt-3 font-body text-[12px] text-[var(--ink-tertiary)]">
            all time, estimated — updates as your agent works
          </p>
        </div>

        <div className="md:max-w-[280px] md:text-right">
          <SharpButton variant="secondary" disabled aria-disabled className="cursor-not-allowed">
            Payouts — coming soon
          </SharpButton>
          <p className="mt-2 font-body text-[12px] leading-[1.5] text-[var(--ink-tertiary)]">
            We&apos;ll email you when payouts open. Nothing to set up yet.
          </p>
        </div>
      </div>

      <p className="mt-4 max-w-[64ch] font-body text-[13px] leading-[1.55] text-[var(--ink-secondary)]">
        Estimated at a ${formatCpm(summary.cpmRate)} CPM with {sharePct}% paid to you. Sandbox ads —
        final rates are set when the exchange opens.
      </p>
    </div>
  )
}
