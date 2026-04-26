import { formatUsdc, worldscanTxUrl } from "@devdrip/shared/format"
import type { PayoutSummary } from "@/lib/wallet-api"

interface PayoutHistoryProps {
  items: PayoutSummary[]
}

const STATUS_STYLES: Record<PayoutSummary["status"], string> = {
  pending: "bg-amber-500/15 text-amber-600",
  processing: "bg-blue-500/15 text-blue-600",
  confirmed: "bg-emerald-500/15 text-emerald-600",
  failed: "bg-red-500/15 text-red-600",
}

// Shared between Mini App's /m/wallet and the dashboard /dashboard/wallet
// since both surfaces render payout rows identically.
export function PayoutHistory({ items }: PayoutHistoryProps) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--ink-secondary)]">No payouts yet.</p>
  }
  return (
    <ul className="flex flex-col divide-y divide-[var(--border-subtle)]">
      {items.map((p) => {
        const txUrl = p.txHash ? worldscanTxUrl(p.txHash) : null
        return (
          <li key={p.id} className="flex items-center justify-between py-3">
            <div className="flex flex-col gap-1">
              <span className="font-medium tabular-nums">{formatUsdc(p.amountUsdc)}</span>
              <span className="text-xs text-[var(--ink-secondary)]">
                {new Date(p.createdAt).toLocaleString("en-US")}
              </span>
              {p.failureReason && <span className="text-xs text-red-500">{p.failureReason}</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[p.status]}`}>
                {p.status}
              </span>
              {txUrl && (
                <a
                  href={txUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--accent)] underline"
                >
                  tx
                </a>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
