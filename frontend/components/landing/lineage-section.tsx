const ROWS = [
  { medium: "Print", surface: "the page", market: "classifieds and display" },
  { medium: "Broadcast", surface: "the break", market: "spot advertising" },
  { medium: "Web", surface: "the page view", market: "display and search exchanges" },
  { medium: "Mobile", surface: "the app session", market: "in-app networks" },
]

// the empty slot: hatched in the accent so the gap reads as a gap
const HATCH = "repeating-linear-gradient(135deg, var(--accent-glow) 0 6px, transparent 6px 12px)"

export function LineageSection() {
  return (
    <section id="lineage" className="bg-[var(--bg-primary)] py-14 md:py-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="mb-8 max-w-[62ch]">
          <h2
            className="font-display text-[24px] md:text-[28px] leading-[1.15] tracking-[-0.02em] text-[var(--ink-primary)] mb-3"
            style={{ fontWeight: 400 }}
          >
            Every medium grew an ad market.
          </h2>
          <p className="font-body text-[15px] leading-[1.65] text-[var(--ink-secondary)]">
            New attention always gets a market. Agents don&apos;t have one yet.
          </p>
        </div>

        {/* a ledger in time order; the last row's market cell is the point */}
        <table className="w-full border-collapse text-left">
          <thead className="hidden sm:table-header-group">
            <tr className="border-b border-[var(--rule-strong)] font-data text-[11px] text-[var(--ink-tertiary)]">
              <th scope="col" className="w-[24%] pb-2 font-normal">
                medium
              </th>
              <th scope="col" className="w-[28%] pb-2 font-normal">
                the surface
              </th>
              <th scope="col" className="pb-2 font-normal">
                the market
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr
                key={row.medium}
                className="grid grid-cols-1 gap-y-0.5 border-b border-[var(--rule-subtle)] py-3.5 sm:table-row sm:py-0"
              >
                <th
                  scope="row"
                  className="font-display text-[17px] tracking-[-0.01em] text-[var(--ink-primary)] sm:py-3.5 sm:pr-4"
                  style={{ fontWeight: 400 }}
                >
                  {row.medium}
                </th>
                <td className="font-data text-[13px] text-[var(--ink-secondary)] sm:py-3.5 sm:pr-4">
                  {row.surface}
                </td>
                <td className="font-data text-[13px] text-[var(--ink-secondary)] sm:py-3.5">
                  {row.market}
                </td>
              </tr>
            ))}
            <tr className="grid grid-cols-1 gap-y-1 py-3.5 sm:table-row sm:py-0">
              <th
                scope="row"
                className="font-display text-[17px] tracking-[-0.01em] text-[var(--ink-primary)] sm:py-4 sm:pr-4"
                style={{ fontWeight: 400 }}
              >
                Agents
              </th>
              <td className="font-data text-[13px] text-[var(--ink-primary)] sm:py-4 sm:pr-4">
                the wait
              </td>
              <td className="sm:py-3">
                <span
                  className="mt-1 block border border-dashed border-[var(--accent-color)] px-3 py-2.5 font-data text-[13px] text-[var(--accent-color)] sm:mt-0"
                  style={{ backgroundImage: HATCH }}
                >
                  nothing yet
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mt-8 max-w-[62ch] font-body text-[15px] leading-[1.65] text-[var(--ink-primary)]">
          Distro is building it.
        </p>
      </div>
    </section>
  )
}
