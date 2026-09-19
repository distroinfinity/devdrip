import Link from "next/link"
import { InstallCommand } from "./install-command"

// two doors: one for the people who watch, one for the people who buy
export function ClosingSection() {
  return (
    <section id="install" className="border-t border-[var(--rule-default)] bg-[var(--bg-primary)]">
      <div className="mx-auto grid max-w-[1200px] md:grid-cols-2">
        <div className="min-w-0 px-6 py-14 md:py-20 md:pr-12">
          <h2
            className="font-display text-[24px] md:text-[28px] leading-[1.15] tracking-[-0.02em] text-[var(--ink-primary)] mb-2"
            style={{ fontWeight: 400 }}
          >
            Run the first surface.
          </h2>
          <p className="mb-6 font-body text-[15px] leading-[1.6] text-[var(--ink-secondary)]">
            One command. macOS and Linux. Works with Claude Code.
          </p>
          <InstallCommand variant="large" />
          <details className="mt-5 border border-[var(--rule-default)] bg-[var(--bg-surface)]">
            <summary className="cursor-pointer px-4 py-3 font-data text-[12px] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]">
              What does this script do?
            </summary>
            <div className="px-4 pb-4 font-body text-[13px] leading-relaxed text-[var(--ink-secondary)]">
              Checks Node 20+, downloads the latest release from GitHub, drops a wrapper at
              <code className="mx-1 font-data text-[12px]">~/.local/bin/distro</code>. No npm. Then
              run <code className="mx-1 font-data text-[12px]">distro init</code> to pair. Source:{" "}
              <a
                className="border-b border-[var(--accent-color)] pb-0.5 text-[var(--accent-color)] no-underline"
                href="/install.sh"
                target="_blank"
                rel="noreferrer"
              >
                /install.sh
              </a>
              .
            </div>
          </details>
        </div>

        <div className="min-w-0 border-t border-[var(--rule-default)] px-6 py-14 md:border-l md:border-t-0 md:py-20 md:pl-12">
          <h2
            className="font-display text-[24px] md:text-[28px] leading-[1.15] tracking-[-0.02em] text-[var(--ink-primary)] mb-2"
            style={{ fontWeight: 400 }}
          >
            A new surface to buy.
          </h2>
          <p className="mb-6 max-w-[44ch] font-body text-[15px] leading-[1.6] text-[var(--ink-secondary)]">
            Developers, waiting on their agent. Write an ad and it runs there.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              href="/advertisers/portal"
              className="inline-block bg-[var(--ink-primary)] px-4 py-2 font-body text-[13px] font-medium text-[var(--bg-primary)] no-underline transition-colors duration-150 hover:bg-[var(--em-hover)]"
            >
              Open the ad portal
            </Link>
            <Link
              href="/advertisers"
              className="border-b border-[var(--rule-strong)] pb-0.5 font-body text-[13px] text-[var(--ink-secondary)] no-underline transition-colors hover:text-[var(--ink-primary)]"
            >
              How it works
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
