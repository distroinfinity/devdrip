import { formatUsdc } from "@devdrip/shared/format"
import { MIN_PAYOUT_USDC } from "@devdrip/shared/constants/chain"
import { ClaimButton } from "./claim-button"

interface BalanceCardProps {
  available: number
  lifetime: number
  pending: number
}

export function BalanceCard({ available, lifetime, pending }: BalanceCardProps) {
  const canClaim = available >= MIN_PAYOUT_USDC
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-[var(--border-subtle)] p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-[var(--ink-secondary)]">Available</span>
        <span className="text-3xl font-semibold tabular-nums">{formatUsdc(available)}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs text-[var(--ink-secondary)]">
        <div>
          Lifetime earned:{" "}
          <span className="text-[var(--ink-primary)] tabular-nums">{formatUsdc(lifetime)}</span>
        </div>
        <div>
          Pending payouts:{" "}
          <span className="text-[var(--ink-primary)] tabular-nums">{formatUsdc(pending)}</span>
        </div>
      </div>
      <ClaimButton available={available} canClaim={canClaim} />
    </section>
  )
}
