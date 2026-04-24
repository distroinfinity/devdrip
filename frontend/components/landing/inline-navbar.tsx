"use client";

import { ThemeToggle } from "@/components/shared/theme-toggle";
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

        {/* right: nav links + theme toggle + cta */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1">
            <a
              href="#"
              className="font-body text-[13px] text-[var(--ink-secondary)] px-3 py-1.5 rounded-md hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              Docs
            </a>
            <a
              href="#"
              className="font-body text-[13px] text-[var(--ink-secondary)] px-3 py-1.5 rounded-md hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              GitHub
            </a>
          </div>
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          <WaitlistButton className="h-9 px-5 text-[13px]" />
        </div>
      </nav>
    </BlurFade>
  );
}
