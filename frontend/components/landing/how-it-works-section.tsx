"use client"

import { motion } from "motion/react"

const BEATS = [
  {
    num: "01",
    headline: "Your agent starts working.",
    body: "Distro TV detects idle. Waits 3 seconds.",
    visualKind: "agent" as const,
  },
  {
    num: "02",
    headline: "A channel lights up.",
    body: "News headlines, market ticks — whatever you've tuned in.",
    visualKind: "tv" as const,
  },
  {
    num: "03",
    headline: "You start typing. It vanishes.",
    body: "< 200ms. No fade. No nag.",
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
          {[
            "3s grace",
            "< 200ms vanish",
            "opt-in",
            "per-channel mute",
            "no auto-play",
            "no tracking",
          ].map((f, i, arr) => (
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

function BeatVisual({ kind }: { kind: "agent" | "tv" | "vanish" }) {
  if (kind === "agent") {
    return (
      <div className="font-data text-[11px] bg-[#0A0A0C] text-[#EDEDF0] px-3 py-2.5 border border-[#1E1E22]">
        <span className="text-[var(--accent-color)] inline-block animate-spin-slow mr-2">⠋</span>
        Claude Code: refactoring 4 files...
      </div>
    )
  }
  if (kind === "tv") {
    return (
      <div className="font-data text-[11px] bg-[#0A0A0C] text-[#EDEDF0] border border-[#1E1E22]">
        <div className="px-3 py-1.5 border-b border-[#1E1E22] text-[10px] text-[#8A8A94]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] mr-2 align-middle" />
          CH 01 · NEWS
        </div>
        <div className="px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-[var(--accent-color)] mb-1">
            TechCrunch
          </div>
          <div className="text-[11px] font-bold leading-snug">
            Anthropic raises $5B at $90B valuation
          </div>
        </div>
      </div>
    )
  }
  // vanish
  return (
    <div className="relative font-data text-[11px] bg-[var(--bg-primary)] text-[var(--ink-secondary)] px-3 py-2.5 border border-dashed border-[var(--rule-default)] text-center">
      <span className="text-[var(--ink-tertiary)]">⌨</span>
      <span className="ml-2">— frame collapsed —</span>
    </div>
  )
}
