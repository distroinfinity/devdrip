"use client"

import type { ReactNode } from "react"
import { motion } from "motion/react"

const BEATS = [
  {
    num: "01",
    headline: "Your agent starts working.",
    body: "Distro TV catches the wait.",
    visualKind: "agent" as const,
  },
  {
    num: "02",
    headline: "A channel lights up.",
    body: "Your tuned-in channels surface.",
    visualKind: "tv" as const,
  },
  {
    num: "03",
    headline: "You start typing. It vanishes.",
    body: "Under 200ms. No fade. No nag.",
    visualKind: "vanish" as const,
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-[var(--bg-secondary)] py-14 md:py-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="pb-4 mb-8 border-b border-[var(--rule-default)]"
        >
          <p className="font-data text-[10px] uppercase tracking-[0.1em] text-[var(--ink-secondary)] mb-1.5">
            <span className="text-[var(--ink-tertiary)]">/ </span>how it works
          </p>
          <h2
            className="font-display text-[24px] md:text-[28px] tracking-[-0.02em] text-[var(--ink-primary)]"
            style={{ fontWeight: 400 }}
          >
            Three beats.
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="grid md:grid-cols-3 gap-5"
        >
          {BEATS.map((beat) => (
            <div
              key={beat.num}
              className="bg-[var(--bg-surface)] border border-[var(--rule-default)] p-5 flex flex-col"
            >
              <div className="font-data text-[11px] tracking-[0.08em] text-[var(--accent-color)] mb-3">
                {beat.num}
              </div>
              <h3
                className="font-display text-[18px] tracking-[-0.02em] text-[var(--ink-primary)] mb-2 leading-snug"
                style={{ fontWeight: 400 }}
              >
                {beat.headline}
              </h3>
              <p className="font-body text-[13px] text-[var(--ink-secondary)] leading-relaxed mb-4 flex-1">
                {beat.body}
              </p>
              <BeatVisual kind={beat.visualKind} />
            </div>
          ))}
        </motion.div>

        {/* bottom data strip */}
        <div className="mt-8 pt-4 border-t border-[var(--rule-default)] flex flex-wrap gap-x-4 gap-y-1 font-data text-[11px] text-[var(--ink-secondary)]">
          {["opt-in", "per-channel mute", "no auto-play", "no tracking"].map((f, i, arr) => (
            <span key={f}>
              {f}
              {i < arr.length - 1 && <span className="text-[var(--ink-tertiary)] ml-4">·</span>}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

// one fixed-height terminal "screen" so all three cards line up; each beat is a
// different state of the same surface.
function ScreenFrame({
  label,
  status,
  children,
}: {
  label: string
  status: string
  children: ReactNode
}) {
  return (
    <div className="flex h-[152px] flex-col overflow-hidden border border-[#1E1E22] bg-[#0A0A0C] font-data text-[12px] text-[#EDEDF0]">
      <div className="flex items-center gap-2 border-b border-[#1E1E22] px-3.5 py-2 text-[10px] text-[#8A8A94]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-color)]" />
        <span>{label}</span>
        <span className="ml-auto text-[#5C5C66]">{status}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center px-4 py-3.5">{children}</div>
    </div>
  )
}

function BeatVisual({ kind }: { kind: "agent" | "tv" | "vanish" }) {
  if (kind === "agent") {
    return (
      <ScreenFrame label="~ · idle detected" status="stop hook">
        <div className="space-y-2">
          <div>
            <span className="mr-2 inline-block animate-spin-slow text-[var(--accent-color)]">
              ⠋
            </span>
            Claude Code · refactoring 4 files…
          </div>
          <div className="text-[#5C5C66]">› surface armed</div>
        </div>
      </ScreenFrame>
    )
  }
  if (kind === "tv") {
    return (
      <ScreenFrame label="CH 01 · NEWS" status="12m ago">
        <div className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--accent-color)]">
          TechCrunch
        </div>
        <div className="text-[13px] font-bold leading-snug">Anthropic closes $13B Series F</div>
      </ScreenFrame>
    )
  }
  // vanish — your terminal returns the instant you type
  return (
    <ScreenFrame label="~ · you typed" status="<200ms">
      <div className="flex h-full items-center text-[#8A8A94]">
        <span className="text-[#EDEDF0]">$</span>
        <span className="ml-2 inline-block h-[15px] w-[7px] animate-pulse bg-[#EDEDF0]" />
        <span className="ml-3 text-[#5C5C66]">surface cleared</span>
      </div>
    </ScreenFrame>
  )
}
