"use client"

import { motion } from "motion/react"
import Link from "next/link"

const CONFIG = `[channels.news]
enabled = true
sources = ["hn", "techcrunch", "bloomberg", "reuters"]

[channels.markets]
enabled = true
watchlist = ["NVDA", "AAPL", "BTC", "ETH"]
alert_threshold = 0.05

[schedule]
grace_seconds = 3
quiet_hours = ["23:00", "07:00"]

[keys]
skip = "s"   kill = "k"   mute = "m"`

const KEYBINDS = [
  { key: "S", label: "skip", desc: "dismiss this slot" },
  { key: "K", label: "kill", desc: "kill all slots for this session" },
  { key: "M", label: "mute 30m", desc: "mute all channels for 30 minutes" },
  { key: "O", label: "open", desc: "open current item in browser (NEWS only)" },
  { key: "L", label: "later", desc: "save to reading list (NEWS only)" },
  { key: "+", label: "add", desc: "add ticker to watchlist (MARKETS only)" },
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
            Tune what you watch. Kill anything in &lt;200ms.
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="grid md:grid-cols-2 gap-5"
        >
          {/* config block */}
          <div>
            <div className="bg-[#0A0A0C] text-[#EDEDF0] border border-[#1E1E22] font-data text-[12px] leading-relaxed">
              <div className="px-3 py-1.5 border-b border-[#1E1E22] text-[10px] text-[#5C5C66] tracking-wider">
                ~/.distrotv/config.toml
              </div>
              <pre className="px-4 py-3 m-0 whitespace-pre overflow-x-auto">{CONFIG}</pre>
            </div>
            <p className="mt-3 font-data text-[11px] text-[var(--ink-tertiary)]">
              Lives in <code className="text-[var(--ink-secondary)]">~/.distrotv/config.toml</code>.
              Edits hot-reload.
            </p>
          </div>

          {/* keybind cheat-sheet */}
          <div>
            <div className="bg-[var(--bg-surface)] border border-[var(--rule-default)]">
              <div className="px-4 py-2.5 border-b border-[var(--rule-default)] font-data text-[10px] uppercase tracking-[0.08em] text-[var(--ink-secondary)]">
                Keybinds
              </div>
              <div>
                {KEYBINDS.map((k) => (
                  <div
                    key={k.key + k.label}
                    className="grid grid-cols-[44px_88px_1fr] gap-3 items-baseline px-4 py-2.5 border-b border-[var(--rule-subtle)] last:border-b-0 font-data text-[12px]"
                  >
                    <span className="text-[var(--accent-color)] font-bold">[{k.key}]</span>
                    <span className="text-[var(--ink-primary)]">{k.label}</span>
                    <span className="text-[var(--ink-secondary)] text-[11px]">{k.desc}</span>
                  </div>
                ))}
              </div>
            </div>
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
