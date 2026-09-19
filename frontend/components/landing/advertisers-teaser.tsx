import Link from "next/link"

export function AdvertisersTeaser() {
  return (
    <section
      id="advertisers"
      className="border-y border-[var(--rule-default)] bg-[var(--bg-primary)] py-14 md:py-20"
    >
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:gap-12 items-center">
          <div>
            <h2
              className="font-display text-[24px] md:text-[28px] leading-[1.15] tracking-[-0.02em] text-[var(--ink-primary)] mb-4"
              style={{ fontWeight: 400 }}
            >
              A new surface to buy.
            </h2>
            <p className="font-body text-[15px] leading-[1.65] text-[var(--ink-secondary)] max-w-[56ch] mb-6">
              Web pages have slots. Cities have billboards. Agent runs have minutes of developer
              attention and, until now, nowhere to place anything. We&apos;re running early
              campaigns by hand while the exchange is built.
            </p>
            <Link
              href="/advertisers"
              className="inline-block bg-[var(--ink-primary)] px-4 py-2 font-body text-[13px] font-medium text-[var(--bg-primary)] no-underline transition-colors duration-150 hover:bg-[var(--em-hover)]"
            >
              See the exchange
            </Link>
          </div>

          {/* an unsold slot, drawn the way the terminal draws a sold one */}
          <div
            aria-hidden="true"
            className="border border-dashed border-[var(--rule-strong)] px-4 py-4 font-data text-[11px] leading-[1.5]"
          >
            <div className="border-l-2 border-[var(--rule-strong)] pl-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span className="border border-[var(--rule-strong)] px-1 text-[9px] font-bold leading-[1.5] text-[var(--ink-secondary)]">
                    AD
                  </span>
                  <span className="text-[12px] font-bold text-[var(--ink-secondary)]">
                    your brand
                  </span>
                </span>
                <span className="text-[var(--ink-tertiary)]">slot open</span>
              </div>
              <div className="mt-1 text-[12px] leading-snug text-[var(--ink-secondary)]">
                One line of copy, in front of a developer waiting on their agent.
              </div>
              <div className="mt-1.5 text-[10px] text-[var(--ink-tertiary)]">↗ yoursite.com</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
