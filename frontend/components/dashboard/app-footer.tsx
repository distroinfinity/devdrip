import { SocialStrip } from "./social-strip"
import { Attribution } from "./attribution"

// single footer used everywhere — wordmark + socials + marketing link + attribution.
// no per-page customization; if you need a variant, add it here as a prop and
// keep it shared.
export function AppFooter() {
  return (
    <footer className="border-t border-[var(--rule-subtle)]">
      <div className="mx-auto flex w-full max-w-grid flex-col items-center justify-between gap-4 px-6 py-6 md:flex-row md:px-12">
        <span className="font-display text-[12px] font-bold tracking-tight text-[var(--ink-tertiary)]">
          dev drip
        </span>

        <nav className="flex items-center gap-4" aria-label="External">
          <SocialStrip variant="footer" />
          <span className="h-3.5 w-px bg-[var(--rule-default)]" />
          <a
            href="https://devdrip.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="font-body text-[13px] font-medium text-[var(--ink-secondary)] transition-colors hover:text-[var(--ink-primary)]"
          >
            devdrip.xyz
          </a>
        </nav>

        <Attribution />
      </div>
    </footer>
  )
}
