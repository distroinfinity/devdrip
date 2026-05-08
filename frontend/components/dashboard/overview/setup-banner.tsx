import type { ChannelDto, WatchlistDto } from "@distrotv/shared"
import { InlineHelp } from "@/components/v5/inline-help"

interface Props {
  channels: ChannelDto[]
  watchlists: WatchlistDto[]
}

interface Step {
  label: string
  done: boolean
}

export function SetupBanner({ channels, watchlists }: Props) {
  const hasChannels = channels.filter((c) => c.subscribed).length > 0
  const hasWatchlist = watchlists.some((w) => w.tickers.length > 0)

  if (hasChannels && hasWatchlist) return null

  const steps: Step[] = [
    { label: "account", done: true },
    { label: "device paired", done: true },
    { label: "pick channels", done: hasChannels },
    { label: "add watchlist", done: hasWatchlist },
  ]

  const doneCount = steps.filter((s) => s.done).length

  return (
    <div
      className="flex items-center gap-4 px-8 py-3 border-b border-[var(--rule-default)]"
      style={{ background: "var(--accent-surface, rgba(79,70,229,0.06))" }}
    >
      <div className="flex items-baseline gap-1.5 shrink-0">
        <span className="font-[var(--font-display)] text-[9px] font-bold tracking-[0.1em] uppercase text-[var(--accent-color)]">
          Setup · {doneCount}/{steps.length}
        </span>
        <InlineHelp>
          finish each step to start seeing slots in your terminal. channels = where news comes from.
          watchlist = which prices you track.
        </InlineHelp>
      </div>

      <div className="flex items-center gap-3">
        {steps.map((step) => (
          <span key={step.label} className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center justify-center w-3 h-3 border text-[8px]"
              style={{
                borderColor: step.done ? "var(--accent-color)" : "var(--rule-default)",
                background: step.done ? "var(--accent-color)" : "transparent",
                color: step.done ? "white" : "transparent",
              }}
            >
              ✓
            </span>
            <span
              className="font-[var(--font-data)] text-[10px]"
              style={{
                color: step.done ? "var(--ink-tertiary)" : "var(--ink-primary)",
                textDecoration: step.done ? "line-through" : "none",
              }}
            >
              {step.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
