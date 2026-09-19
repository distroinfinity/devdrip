import { formatUsdEstimate } from "@/lib/format"
import type { RecentAd } from "@/lib/dashboard-api"

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return "—"
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000))
  if (sec < 60) return "just now"
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const TH =
  "px-4 py-2.5 text-left font-display text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-tertiary)] whitespace-nowrap"
const TD = "px-4 py-3 align-middle whitespace-nowrap"

export function RecentAds({ items }: { items: RecentAd[] }) {
  return (
    <section className="border border-[var(--rule-default)] bg-[var(--bg-surface)]">
      <header className="flex items-baseline justify-between gap-3 border-b border-[var(--rule-default)] px-4 py-3">
        <h2 className="font-display text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-tertiary)]">
          Recent ads
        </h2>
        <span className="font-body text-[11px] text-[var(--ink-tertiary)]">
          newest {items.length}
        </span>
      </header>

      {items.length === 0 ? (
        <p className="px-4 py-6 font-body text-[13px] text-[var(--ink-secondary)]">
          nothing seen yet — ads you see in your terminal are listed here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--rule-default)]">
                <th scope="col" className={TH}>
                  Advertiser
                </th>
                <th scope="col" className={TH}>
                  Headline
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Seen for
                </th>
                <th scope="col" className={TH}>
                  Clicked
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Est. earned
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  When
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule-default)]">
              {items.map((ad) => (
                <tr key={ad.id}>
                  <td className={`${TD} font-body text-[13px] text-[var(--ink-primary)]`}>
                    <span className="inline-flex items-center gap-2">
                      {ad.advertiser}
                      {ad.source === "house" && (
                        <span className="border border-[var(--rule-default)] px-1.5 py-px font-data text-[9px] uppercase tracking-[0.08em] text-[var(--ink-tertiary)]">
                          demo
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle font-body text-[13px] text-[var(--ink-secondary)]">
                    <span className="block max-w-[280px] truncate" title={ad.headline}>
                      {ad.headline}
                    </span>
                  </td>
                  <td
                    className={`${TD} text-right font-data text-[12px] tabular-nums text-[var(--ink-secondary)]`}
                  >
                    {ad.result === "skipped" && (
                      <span className="mr-2 text-[10px] text-[var(--ink-tertiary)]">skipped</span>
                    )}
                    {(ad.durationMs / 1000).toFixed(0)}s
                  </td>
                  <td
                    className={`${TD} font-data text-[12px] ${
                      ad.clicked ? "text-[var(--accent-color)]" : "text-[var(--ink-tertiary)]"
                    }`}
                  >
                    {ad.clicked ? "yes" : "—"}
                  </td>
                  <td
                    className={`${TD} text-right font-data text-[12px] tabular-nums text-[var(--ink-primary)]`}
                  >
                    {formatUsdEstimate(ad.earned)}
                  </td>
                  <td
                    className={`${TD} text-right font-data text-[11px] tabular-nums text-[var(--ink-tertiary)]`}
                  >
                    {formatRelative(ad.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
