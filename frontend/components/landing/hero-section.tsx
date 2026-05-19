"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { TerminalTV } from "./terminal-tv"
import { InstallCommand } from "./install-command"

const CHIPS = [
  { label: "CH 01 · NEWS", state: "on" as const },
  { label: "CH 02 · MARKETS", state: "on" as const },
  { label: "CH 0? · COMING", state: "dim" as const },
]

export function HeroSection() {
  return (
    <section className="relative">
      {/* dot-grid bg */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, var(--dot-grid-color) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
          opacity: 0.5,
        }}
      />

      <div className="relative mx-auto max-w-[1200px] px-6 py-14 md:py-20">
        <div className="grid md:grid-cols-[1.05fr_1fr] gap-8 md:gap-12 items-start">
          {/* left column */}
          <div>
            <p className="font-data text-[10px] uppercase tracking-[0.1em] text-[var(--ink-secondary)] mb-5 flex items-center">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] mr-2" />
              v0.1 · 2 channels live
            </p>

            <h1
              className="font-display text-[32px] md:text-[38px] leading-[1.04] tracking-[-0.025em] text-[var(--ink-primary)] mb-4"
              style={{ fontWeight: 400 }}
            >
              Channels for the moments
              <br />
              your agent runs the keyboard.
            </h1>

            <p className="font-body text-[14px] leading-[1.55] text-[var(--ink-secondary)] mb-6 max-w-[42ch]">
              An ambient surface that runs while your AI codes. Vanishes the instant you type.
            </p>

            <div className="mb-3">
              <InstallCommand variant="hero" />
            </div>
            <div className="mb-6">
              <Link
                href="#how-it-works"
                className="font-data text-[11px] text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)] no-underline border-b border-[var(--rule-default)] pb-0.5 transition-colors"
              >
                how it works →
              </Link>
            </div>

            <motion.div
              className="flex flex-wrap gap-2 mb-3"
              initial="hidden"
              animate="visible"
              variants={{
                visible: { transition: { staggerChildren: 0.05 } },
                hidden: {},
              }}
            >
              {CHIPS.map((chip) => (
                <motion.span
                  key={chip.label}
                  variants={{
                    hidden: { opacity: 0, y: 6 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                    },
                  }}
                  className={cn(
                    "font-data text-[10px] uppercase tracking-[0.04em] px-2.5 py-1.5 inline-flex items-center gap-2",
                    chip.state === "on"
                      ? "bg-[var(--bg-surface)] text-[var(--ink-primary)] border border-[var(--rule-default)]"
                      : "bg-transparent text-[var(--ink-tertiary)] border border-dashed border-[var(--rule-default)]"
                  )}
                >
                  {chip.state === "on" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)]" />
                  )}
                  {chip.label}
                </motion.span>
              ))}
            </motion.div>

            <p className="font-data text-[10px] tracking-[0.04em] text-[var(--ink-tertiary)]">
              opt-in · subscribe per channel · skip anything
            </p>
          </div>

          {/* right column — terminal tv */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <TerminalTV
              blocks={[
                {
                  kind: "news",
                  id: "hero-news",
                  title: "CH 01 · NEWS",
                  status: "12m ago",
                  items: [
                    {
                      source: "TechCrunch",
                      headline: "Anthropic closes $13B Series F at $183B valuation",
                      meta: "12m ago",
                    },
                    {
                      source: "HN · 412",
                      headline: "Show HN: a terminal-native ambient feed for AI idle time",
                      meta: "28m ago",
                    },
                  ],
                },
                {
                  kind: "markets",
                  id: "hero-markets",
                  title: "CH 02 · MARKETS",
                  status: "live · 1s tick",
                  rows: [
                    {
                      symbol: "NVDA",
                      price: "948.20",
                      delta: "+2.14%",
                      direction: "up",
                      sparkline: "▁▂▃▅▇█▇",
                    },
                    {
                      symbol: "AAPL",
                      price: "187.65",
                      delta: "+0.43%",
                      direction: "up",
                      sparkline: "▁▂▂▃▃▃▃",
                    },
                    {
                      symbol: "BTC",
                      price: "73,412",
                      delta: "+1.07%",
                      direction: "up",
                      sparkline: "▁▂▄▃▅▆▇",
                    },
                    {
                      symbol: "ETH",
                      price: "3,892",
                      delta: "+1.88%",
                      direction: "up",
                      sparkline: "▂▃▃▄▅▆▇",
                    },
                  ],
                },
              ]}
              footerKeys="[S]kip   [K]ill   [M]ute 30m"
              footerRight="~/.distrotv/config.toml"
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
