import { SharpButton } from "@/components/v5/sharp-button"
import { formatUsdEstimate } from "@/lib/format"
import type { EarningsSummary } from "@/lib/dashboard-api"

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
      <h1 className="mt-2 font-display text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--ink-primary)] md:text-[40px]">
        estimated earnings
      </h1>

      <div className="mt-6 flex flex-col gap-6 border-y border-[var(--rule-default)] py-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="font-data text-[48px] leading-none tracking-[-0.03em] tabular-nums text-[var(--ink-primary)] md:text-[64px]">
            {formatUsdEstimate(summary.allTime)}
          </p>
          <p className="mt-3 font-body text-[12px] text-[var(--ink-tertiary)]">
            all time, estimated
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
