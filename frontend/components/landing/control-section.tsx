"use client"

import { motion } from "motion/react"
import Link from "next/link"

const INIT_TRANSCRIPT = `$ distro init

◇  distro init — let's get you set up
│
◇  ads are on
│  sponsored slots play while your
│  agent works. you earn an estimated
│  70% share of every ad you see.
│  turn them off: dtv preferences
│
◆  also tune in to news or markets?
│  ○ yes   ● no  (optional)
│
◇  health check
│  ✓ daemon socket     ready
│  ✓ agent hook        installed
│  ✓ api reachable     400ms
│
└  all set — ads play while your
   agent works.`

const COMMANDS = [
  { cmd: "dtv open", desc: "open the sponsor or story on screen" },
  { cmd: "dtv skip", desc: "advance to the next slot" },
  { cmd: "dtv mute", desc: "pause everything for 30 minutes" },
  { cmd: "dtv kill-session", desc: "stop slots for the rest of this session" },
  { cmd: "dtv preferences", desc: "turn ads, news or markets on or off" },
]

export function ControlSection() {
  return (
    <section id="control" className="bg-[var(--bg-primary)] py-14 md:py-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="pb-4 mb-8 border-b border-[var(--rule-default)]"
        >
          <p className="font-data text-[10px] uppercase tracking-[0.1em] text-[var(--ink-secondary)] mb-1.5">
            <span className="text-[var(--ink-tertiary)]">/ </span>control
          </p>
          <h2
            className="font-display text-[24px] md:text-[28px] tracking-[-0.02em] text-[var(--ink-primary)]"
            style={{ fontWeight: 400 }}
          >
            You set the rules.
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="grid md:grid-cols-2 gap-5"
        >
          {/* distro init flow */}
          <div className="min-w-0">
            <div className="bg-[#0A0A0C] text-[#EDEDF0] border border-[#1E1E22] font-data text-[11px] leading-relaxed">
              <div className="px-3 py-1.5 border-b border-[#1E1E22] text-[10px] text-[#5C5C66] tracking-wider flex items-center justify-between">
                <span>terminal · distro init</span>
                <span className="text-[#6366F1]">● live</span>
              </div>
              <pre className="px-4 py-3 m-0 whitespace-pre overflow-x-auto text-[12px]">
                {INIT_TRANSCRIPT}
              </pre>
            </div>
          </div>

          {/* command cheat-sheet */}
          <div className="min-w-0">
            <div className="bg-[var(--bg-surface)] border border-[var(--rule-default)]">
              <div className="px-4 py-2.5 border-b border-[var(--rule-default)] font-data text-[10px] uppercase tracking-[0.08em] text-[var(--ink-secondary)]">
                Commands
              </div>
              <div>
                {COMMANDS.map((c) => (
                  <div
                    key={c.cmd}
                    className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-x-3 gap-y-0.5 items-baseline px-4 py-2.5 border-b border-[var(--rule-subtle)] last:border-b-0 font-data text-[12px]"
                  >
                    <span className="text-[var(--accent-color)] font-bold">{c.cmd}</span>
                    <span className="text-[var(--ink-secondary)] text-[11px]">{c.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-3 max-w-[52ch] font-body text-[13px] leading-[1.55] text-[var(--ink-secondary)]">
              Run them from any terminal. The same feeds toggle lives in the dashboard — ads, news
              and markets each switch on or off on their own.
            </p>
            <p className="mt-3 font-data text-[11px]">
              <Link
                href="/dashboard"
                className="text-[var(--accent-color)] border-b border-[var(--accent-color)] pb-0.5 hover:text-[var(--accent-hover)] no-underline"
              >
                Or edit from the dashboard →
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
