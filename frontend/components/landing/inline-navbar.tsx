"use client";

import { WaitlistButton } from "@/components/shared/waitlist-button";
import { BlurFade } from "@/components/ui/blur-fade";

export function InlineNavbar() {
  return (
    <BlurFade delay={0} direction="down" duration={0.4}>
      <nav className="flex items-center justify-between px-6 py-4 mx-auto max-w-grid">
        {/* left: logo + version badge */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-[5px] bg-[var(--ink-primary)] flex items-center justify-center">
            <div className="w-1.5 h-2.5 rounded-b-sm bg-[var(--ink-inverse)] opacity-90" />
          </div>
          <span className="font-display text-[17px] font-bold tracking-tight">
            dev drip
          </span>
          <span className="font-data text-[9px] font-medium tracking-[0.06em] border border-[var(--accent-color)] text-[var(--accent-color)] px-1.5 py-0.5 rounded-[3px]">
            v0.1
          </span>
        </div>

        {/* right: nav links + cta */}
        <div className="flex items-center gap-4">
          <a
              href="https://x.com/devdrip_"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (Twitter)"
              className="hidden md:flex items-center text-[var(--ink-secondary)] px-3 py-1.5 rounded-md hover:bg-[var(--bg-surface-hover)] hover:text-[var(--ink-primary)] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          <WaitlistButton href="#waitlist" className="h-9 px-5 text-[13px]" />
        </div>
      </nav>
    </BlurFade>
  );
}
