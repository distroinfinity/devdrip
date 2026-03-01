"use client";

import { BlurFade } from "@/components/ui/blur-fade";

export function ScrollNudge() {
  return (
    <BlurFade delay={1.8} direction="down" duration={0.4} inView>
      <a
        href="#dead-time"
        aria-label="Scroll down"
        className="flex flex-col items-center gap-2 py-6 group"
      >
        <span className="font-data text-[10px] tracking-[0.12em] uppercase text-[var(--ink-faint)] group-hover:text-[var(--ink-tertiary)] transition-colors">
          scroll
        </span>
        <svg
          width="14"
          height="20"
          viewBox="0 0 14 20"
          fill="none"
          className="text-[var(--ink-faint)] group-hover:text-[var(--ink-tertiary)] transition-colors animate-[nudge_2s_ease-in-out_infinite]"
        >
          <path
            d="M7 0v16m0 0l-5-5m5 5l5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </a>
    </BlurFade>
  );
}
