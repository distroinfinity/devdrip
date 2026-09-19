import Link from "next/link"
import { InstallCommand } from "./install-command"
import { TerminalDemo } from "./terminal-demo"

export function HeroSection() {
  return (
    <section className="relative">
      {/* dot-grid bg */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, var(--dot-grid-color) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
          opacity: 0.5,
        }}
      />

      <div className="relative mx-auto max-w-[1200px] px-6 py-14 md:py-20">
        <div className="grid md:grid-cols-[1.05fr_1fr] gap-8 md:gap-12 items-start">
          {/* left column */}
          <div className="min-w-0">
            <h1
              className="font-display text-[32px] md:text-[40px] leading-[1.06] tracking-[-0.025em] text-[var(--ink-primary)] mb-5 max-w-[16ch]"
              style={{ fontWeight: 400 }}
            >
              The ad exchange for AI agent surfaces.
            </h1>

            <p className="font-body text-[15px] leading-[1.6] text-[var(--ink-secondary)] mb-8 max-w-[52ch]">
              AI agents do the work. People wait and watch. That attention has no market yet. Distro
              is building it, starting in the terminal.
            </p>

            <p className="font-data text-[11px] text-[var(--ink-secondary)] mb-2">
              Run the first surface
            </p>
            <div className="mb-4">
              <InstallCommand variant="hero" />
            </div>
            <div>
              <Link
                href="/advertisers"
                className="font-data text-[12px] text-[var(--ink-primary)] no-underline border-b border-[var(--rule-strong)] pb-0.5 transition-colors hover:border-[var(--ink-primary)]"
              >
                For advertisers
              </Link>
            </div>
          </div>

          {/* right column — the one moving thing on the page */}
          <div className="min-w-0">
            <TerminalDemo />
          </div>
        </div>
      </div>
    </section>
  )
}
