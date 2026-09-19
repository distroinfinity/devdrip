import type { SyncedPreferences, ChannelDto } from "@distrotv/shared"

const MODE_LABELS: Record<string, string> = {
  news_only: "news only",
  news_heavy: "news heavy · 3:1",
  balanced: "mix · 1:1",
  ticker_heavy: "ticker heavy · 1:3",
  ticker_only: "ticker only",
}

function formatQuietHours(prefs: {
  quietHoursStart: number | null
  quietHoursEnd: number | null
}): string {
  if (prefs.quietHoursStart == null || prefs.quietHoursEnd == null) return "off"
  const fmt = (mins: number) =>
    `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`
  return `${fmt(prefs.quietHoursStart)} → ${fmt(prefs.quietHoursEnd)}`
}

interface Props {
  prefs: SyncedPreferences
  channels: ChannelDto[]
  watchlistTickers: string[]
  globalAlertThreshold: number | null
}

export function ConfigReadout({ prefs, channels, watchlistTickers, globalAlertThreshold }: Props) {
  const subscribed = channels.filter((c) => c.subscribed).map((c) => c.key)
  const dtClass =
    "font-[var(--font-display)] text-[9px] font-bold tracking-[0.1em] uppercase text-[var(--ink-tertiary)] mt-3"
  const ddClass = "m-0 text-[var(--ink-primary)]"
  return (
    <dl className="font-[var(--font-data)] text-[10.5px] leading-[1.85] text-[var(--ink-secondary)] mt-1.5 pt-4 border-t border-[var(--rule-default)]">
      <dt className={dtClass.replace("mt-3", "")}>mode</dt>
      <dd className={ddClass}>
        <span className="text-[var(--accent-color)]">
          {MODE_LABELS[prefs.channelMode] ?? prefs.channelMode}
        </span>
      </dd>
      <dt className={dtClass}>channels</dt>
      <dd className={ddClass}>{subscribed.length ? subscribed.join(" · ") : "none"}</dd>
      <dt className={dtClass}>watchlist</dt>
      <dd className={ddClass}>{watchlistTickers.length ? watchlistTickers.join(" ") : "empty"}</dd>
      <dt className={dtClass}>alerts</dt>
      <dd className={`${ddClass} tabular-nums`}>global ±{globalAlertThreshold ?? 5}%</dd>
      <dt className={dtClass}>quiet hours</dt>
      <dd className={`${ddClass} tabular-nums`}>{formatQuietHours(prefs)}</dd>
    </dl>
  )
}
