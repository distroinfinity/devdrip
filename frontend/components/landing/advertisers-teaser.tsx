import Link from "next/link"

export function AdvertisersTeaser() {
  return (
    <section
      id="advertisers"
      className="border-y border-[var(--rule-default)] bg-[var(--bg-secondary)] py-14 md:py-20"
    >
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:gap-12 items-center">
          <div>
            <p className="font-data text-[10px] uppercase tracking-[0.1em] text-[var(--ink-secondary)] mb-1.5">
              <span className="text-[var(--ink-tertiary)]">/ </span>for advertisers
            </p>
            <h2
              className="font-display text-[24px] md:text-[28px] leading-[1.15] tracking-[-0.02em] text-[var(--ink-primary)] mb-4"
              style={{ fontWeight: 400 }}
            >
              A new ad surface: the developer&apos;s terminal.
            </h2>
            <p className="font-body text-[14px] leading-[1.6] text-[var(--ink-secondary)] max-w-[56ch] mb-6">
              Web pages have ad slots. Cities have billboards. AI agents have idle minutes — with a
              developer watching. We&apos;re building the open exchange where anyone can bid for
              that space.
            </p>
            <Link
              href="/advertisers"
              className="inline-block bg-[var(--ink-primary)] px-4 py-2 font-body text-[13px] font-medium text-[var(--bg-primary)] no-underline transition-colors duration-150 hover:bg-[var(--em-hover)]"
            >
              See the exchange →
            </Link>
          </div>

          {/* an unsold slot, drawn the way the terminal draws a sold one */}
          <div
            aria-hidden="true"
            className="border border-dashed border-[var(--rule-strong)] px-4 py-4 font-data text-[11px] leading-[1.5]"
          >
            <div className="mb-2 flex items-center justify-between gap-3 text-[10px] tracking-wider">
              <span>
                <span className="mr-1.5 text-[var(--accent-color)]">▍</span>
                <span className="font-bold text-[var(--accent-color)]">sponsored</span>
                <span className="mx-1.5 text-[var(--ink-tertiary)]">·</span>
                <span className="text-[var(--ink-tertiary)]">slot open</span>
              </span>
              <span className="text-[var(--ink-tertiary)]">bid —</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--ink-tertiary)]">
              your brand
            </div>
            <div className="mt-0.5 text-[13px] font-bold leading-snug text-[var(--ink-secondary)]">
              One line of copy, in front of a developer waiting on their agent.
            </div>
            <div className="mt-2 text-[10px] tracking-wider text-[var(--ink-tertiary)]">
              ↗ yoursite.com · dtv open
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
