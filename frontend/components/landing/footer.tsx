const NAV_LINKS = [
  { label: "Docs", href: "#" },
  { label: "GitHub", href: "https://github.com/distroinfinity/devdrip" },
  { label: "Privacy", href: "#" },
  { label: "Terms", href: "#" },
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
        </nav>

        {/* attribution */}
        <span className="font-data text-[10px] text-[var(--ink-faint)]">
          Powered by USD on Base
        </span>
      </div>
    </footer>
  );
}
