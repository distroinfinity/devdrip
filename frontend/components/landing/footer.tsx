import { ThemeToggle } from "@/components/shared/theme-toggle";

const NAV_LINKS = [
  { label: "Twitter", href: "https://x.com/devdrip_" },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-[var(--rule-default)] bg-[var(--bg-primary)]">
      <div className="mx-auto max-w-grid px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* wordmark */}
        <span className="font-display text-[12px] font-bold text-[var(--ink-tertiary)] tracking-tight">
          dev drip
        </span>

        {/* nav links */}
        <nav className="flex items-center gap-4">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="font-body text-[13px] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] transition-colors"
            >
              {link.label}
            </a>
          ))}
          <span className="h-3.5 w-px bg-[var(--rule-default)]" />
          <ThemeToggle className="font-body text-[13px] font-medium text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] transition-colors" />
        </nav>

        {/* attribution */}
        <span className="font-data text-[10px] text-[var(--ink-faint)]">
          built with{" "}
          <svg
            width="9"
            height="9"
            viewBox="0 0 9 9"
            fill="currentColor"
            className="inline-block -mt-px text-[var(--ink-tertiary)]"
            role="img"
            aria-label="love"
          >
            {/* 9x9 pixel heart on a 1px grid */}
            <rect x="1" y="0" width="2" height="1" />
            <rect x="6" y="0" width="2" height="1" />
            <rect x="0" y="1" width="4" height="1" />
            <rect x="5" y="1" width="4" height="1" />
            <rect x="0" y="2" width="9" height="1" />
            <rect x="0" y="3" width="9" height="1" />
            <rect x="1" y="4" width="7" height="1" />
            <rect x="2" y="5" width="5" height="1" />
            <rect x="3" y="6" width="3" height="1" />
            <rect x="4" y="7" width="1" height="1" />
          </svg>
          {" "}by{" "}
          <a
            href="https://www.linkedin.com/in/yugandhar-tripathi/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)] transition-colors underline underline-offset-2"
          >
            yugandhar
          </a>
          {" "}&{" "}
          <a
            href="https://www.linkedin.com/in/manurajput2911"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)] transition-colors underline underline-offset-2"
          >
            manu
          </a>
        </span>
      </div>
    </footer>
  );
}
