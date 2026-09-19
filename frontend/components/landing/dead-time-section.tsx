"use client"

import { motion } from "motion/react"

const STATS = [
  { value: "15–60 min", label: "idle per day" },
  { value: "30s+", label: "per agentic task" },
  { value: "85%", label: "of devs use AI tools" },
  { value: "↑ YoY", label: "as agents take longer tasks" },
]

export function DeadTimeSection() {
  return (
    <section
      id="dead-time"
      className="border-y border-[var(--rule-default)] bg-[var(--bg-surface)] py-14 md:py-20"
    >
      <div className="mx-auto max-w-[1200px] px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:gap-12 items-start"
        >
          <div>
            <p className="font-data text-[10px] uppercase tracking-[0.1em] text-[var(--ink-secondary)] mb-1.5">
              <span className="text-[var(--ink-tertiary)]">/ </span>dead time
            </p>
            <h2
              className="font-display text-[24px] md:text-[28px] tracking-[-0.02em] text-[var(--ink-primary)] mb-4"
              style={{ fontWeight: 400 }}
            >
              Your agent works. You wait.
            </h2>
            <p className="font-body text-[14px] leading-[1.6] text-[var(--ink-secondary)] max-w-[48ch]">
              Every agent run is a stretch of minutes where you&apos;re watching a terminal. That
              attention is worth something — we think it should be worth something to you.
            </p>
          </div>

          <div>
            {/* 1px gaps over a rule-colored bed draw the cell borders */}
            <dl className="m-0 grid grid-cols-2 gap-px border border-[var(--rule-default)] bg-[var(--rule-default)]">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col-reverse justify-end bg-[var(--bg-primary)] px-4 py-5 md:px-5"
                >
                  <dt className="mt-2 font-data text-[10px] tracking-[0.04em] text-[var(--ink-secondary)]">
                    {stat.label}
                  </dt>
                  <dd
                    className="m-0 font-display text-[22px] md:text-[26px] leading-none tracking-[-0.02em] text-[var(--ink-primary)]"
                    style={{ fontWeight: 400 }}
                  >
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 font-data text-[10px] leading-relaxed tracking-[0.02em] text-[var(--ink-tertiary)]">
              figures from public developer surveys and our own usage; directional, not audited.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
