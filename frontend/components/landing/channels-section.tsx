"use client"

import { motion } from "motion/react"
import { ChannelCard } from "./channel-card"
import { ComingChannelsCard } from "./coming-channels-card"

export function ChannelsSection() {
  return (
    <section id="channels" className="bg-[var(--bg-primary)] py-14 md:py-20">
      <div className="mx-auto max-w-[1200px] px-6">
        {/* section header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="flex justify-between items-end pb-4 mb-8 border-b border-[var(--rule-default)] flex-wrap gap-3"
        >
          <div>
            <p className="font-data text-[10px] uppercase tracking-[0.1em] text-[var(--ink-secondary)] mb-1.5">
              <span className="text-[var(--ink-tertiary)]">/ </span>channels
            </p>
            <h2
              className="font-display text-[24px] md:text-[28px] tracking-[-0.02em] text-[var(--ink-primary)]"
              style={{ fontWeight: 400 }}
            >
              Two live. More queued.
            </h2>
          </div>
          <p className="font-data text-[10px] tracking-[0.04em] text-[var(--ink-tertiary)]">
            opt-in per channel · subscribe to one or both · vanish with one key
          </p>
        </motion.div>

        {/* two cards */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="grid md:grid-cols-2 gap-5"
        >
          <ChannelCard
            channelId="CH 01"
            channelName="NEWS"
            title="The signal, not the timeline."
            blurb="Ranked tech and finance headlines. Two or three at a time, refreshed every 30 min."
            sources={["Hacker News", "TechCrunch", "Bloomberg", "Reuters"]}
            features={["rank by votes + recency", "deep-link to source", "save for later"]}
            previewFooterKeys="[S]kip   [O]pen   [L]ater   [K]ill"
            preview={{
              kind: "news",
              id: "ch1-preview",
              title: "CH 01 · NEWS · broadcasting",
              status: "live",
              items: [
                {
                  source: "TechCrunch",
                  headline: "Anthropic closes $13B Series F at $183B valuation",
                  meta: "12m ago",
                },
                {
                  source: "HN · 412 pts",
                  headline: "Show HN: a terminal-native ambient feed for AI idle time",
                  meta: "28m ago",
                },
                {
                  source: "Bloomberg",
                  headline: "Nvidia hits $4T market cap as data-center demand outpaces capacity",
                  meta: "1h ago",
                },
              ],
            }}
          />

          <ChannelCard
            channelId="CH 02"
            channelName="MARKETS"
            title="Your watchlist, while you wait."
            blurb="Stocks and crypto. Live ticks, sparklines, alerts on >5% moves."
            sources={["Stocks", "Crypto", "FX", "Indices"]}
            features={["your watchlist", "alerts on >5% moves", "edit from dashboard"]}
            previewFooterKeys="[S]kip   [A]lert   [+]add   [K]ill"
            preview={{
              kind: "markets",
              id: "ch2-preview",
              title: "CH 02 · MARKETS · live",
              status: "1s tick",
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
                  symbol: "TSLA",
                  price: "352.18",
                  delta: "-1.22%",
                  direction: "down",
                  sparkline: "▇▆▅▄▃▂▁",
                },
                {
                  symbol: "BTC",
                  price: "73,412",
                  delta: "+1.07%",
                  direction: "up",
                  sparkline: "▁▂▄▃▅▆▇",
                },
                {
                  symbol: "SPY",
                  price: "528.61",
                  delta: "+0.42%",
                  direction: "up",
                  sparkline: "▁▂▃▄▅▅▆",
                },
              ],
            }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <ComingChannelsCard />
        </motion.div>
      </div>
    </section>
  )
}
