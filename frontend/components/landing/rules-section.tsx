import { ChannelCard } from "./channel-card"
import { ComingChannelsCard } from "./coming-channels-card"
import type { NewsItem, TickerItem } from "./terminal-tv"

const RULES = [
  { rule: "Opt-in, always.", detail: "Nobody sees a slot they didn't install." },
  {
    rule: "Never in the way.",
    detail: "Slots appear only while the agent is working and clear the moment you type.",
  },
  {
    rule: "The viewer gets paid.",
    detail:
      "70% of what a slot earns goes to the person watching it. Earnings are estimates until payouts open.",
  },
  {
    rule: "A view has to be real.",
    detail: "An ad counts only if it was on screen for at least a second and wasn't skipped.",
  },
  {
    rule: "The slot isn't only for ads.",
    detail:
      "Tune it to news or markets and it carries those instead. Same surface, no ads, no earnings.",
  },
]

export function RulesSection({
  marketRows,
  newsItems,
}: {
  marketRows: TickerItem[]
  newsItems: NewsItem[]
}) {
  return (
    <section id="rules" className="bg-[var(--bg-secondary)] py-14 md:py-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <h2
          className="font-display text-[24px] md:text-[28px] leading-[1.15] tracking-[-0.02em] text-[var(--ink-primary)] mb-8"
          style={{ fontWeight: 400 }}
        >
          Rules the exchange runs on.
        </h2>

        <dl className="m-0 border-t border-[var(--rule-strong)]">
          {RULES.map((r) => (
            <div
              key={r.rule}
              className="grid gap-x-8 gap-y-1 border-b border-[var(--rule-default)] py-4 md:grid-cols-[1fr_1.6fr]"
            >
              <dt
                className="font-display text-[17px] tracking-[-0.01em] text-[var(--ink-primary)]"
                style={{ fontWeight: 400 }}
              >
                {r.rule}
              </dt>
              <dd className="m-0 font-body text-[15px] leading-[1.6] text-[var(--ink-secondary)] max-w-[60ch]">
                {r.detail}
              </dd>
            </div>
          ))}
        </dl>

        {/* the last rule, shown: the same slot carrying channels */}
        <div id="channels" className="mt-8 grid md:grid-cols-2 gap-5 scroll-mt-20">
          <ChannelCard
            channelId="CH 01"
            channelName="NEWS"
            title="Top stories."
            blurb="Ranked tech & finance, fresh every 30 min."
            sources={["Hacker News", "TechCrunch", "Bloomberg", "Reuters"]}
            previewFooterKeys="dtv skip   ·   dtv mute"
            preview={{
              kind: "news",
              id: "ch1-preview",
              title: "CH 01 · NEWS",
              status: "live",
              items: newsItems,
            }}
          />
          <ChannelCard
            channelId="CH 02"
            channelName="MARKETS"
            title="Your watchlist, while you wait."
            blurb="Live stock & crypto ticks with sparklines."
            sources={["Stocks", "Crypto", "FX", "Indices"]}
            previewFooterKeys="dtv skip   ·   dtv mute   ·   dtv watchlist"
            preview={{
              kind: "markets",
              id: "ch2-preview",
              title: "CH 02 · MARKETS",
              status: "live · 15m",
              rows: marketRows,
            }}
          />
        </div>
        <ComingChannelsCard />
      </div>
    </section>
  )
}
