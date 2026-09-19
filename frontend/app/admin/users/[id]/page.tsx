import Link from "next/link"
import { notFound } from "next/navigation"
import { adminApi } from "@/lib/admin-api"
import type { UserDrilldown } from "@/lib/admin-api"

function relativeTime(iso: string | null): string {
  if (!iso) return "—"
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`
  return `${Math.round(ms / 86_400_000)}d ago`
}

function minToHHMM(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

interface Preferences {
  channelMode?: string
  quietHoursStart?: number | null
  quietHoursEnd?: number | null
  tzOffsetMinutes?: number
}

interface Device {
  id: string
  deviceName: string | null
  os: string
  ideType: string
  lastHeartbeat: string | null
  createdAt: string
}

interface ChannelSub {
  channelId: string
  subscribed: boolean
  priority: number
}

interface WatchlistTicker {
  symbol: string
  assetClass: string
  priority: number
}

interface AlertRule {
  id: string
  scope: string
  symbol: string | null
  thresholdPct: number
}

interface AlertEvent {
  id: string
  symbol: string
  changePct: number
  thresholdPct: number
  firedAt: string
}

interface Impression {
  id: string
  kind: string
  source: string
  durationMs: number
  result: string
  saved: boolean
  createdAt: string
}

export default async function UserDrilldownPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let data: UserDrilldown
  try {
    data = await adminApi.user(id)
  } catch {
    notFound()
  }

  const user = data.user
  const prefs = data.preferences as Preferences | null
  const devices = data.devices as Device[]
  const channelSubs = data.channelSubscriptions as ChannelSub[]
  const watchlistTickers = data.watchlistTickers as WatchlistTicker[]
  const alertRules = data.alerts as AlertRule[]
  const recentAlertEvents = data.recentAlertEvents as AlertEvent[]
  const recentImpressions = data.recentImpressions as Impression[]

  const dt =
    "font-[var(--font-display)] text-[9px] font-bold tracking-[0.1em] uppercase text-[var(--ink-tertiary)]"
  const dd = "m-0 text-[var(--ink-primary)] font-[var(--font-data)] text-[11px]"

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/admin/users"
          className="font-[var(--font-data)] text-[10px] text-[var(--accent-color)] hover:underline"
        >
          ← back to users
        </Link>
        <h1 className="font-[var(--font-display)] text-[18px] font-bold tracking-[-0.02em] mt-2">
          {user.email ?? user.id}
        </h1>
      </div>

      {/* identity */}
      <Section title="identity">
        <dl className="space-y-2">
          <div>
            <dt className={dt}>email</dt>
            <dd className={dd}>{user.email ?? "—"}</dd>
          </div>
          <div>
            <dt className={dt}>user id</dt>
            <dd className={dd}>{user.id}</dd>
          </div>
          <div>
            <dt className={dt}>joined</dt>
            <dd className={dd}>{new Date(user.createdAt).toISOString()}</dd>
          </div>
        </dl>
      </Section>

      {/* preferences */}
      <Section title="preferences">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 max-w-md">
          <div>
            <dt className={dt}>mode</dt>
            <dd className={dd}>{prefs?.channelMode ?? "—"}</dd>
          </div>
          <div>
            <dt className={dt}>quiet hours</dt>
            <dd className={dd}>
              {prefs?.quietHoursStart != null && prefs?.quietHoursEnd != null
                ? `${minToHHMM(prefs.quietHoursStart)} → ${minToHHMM(prefs.quietHoursEnd)}`
                : "off"}
            </dd>
          </div>
          <div>
            <dt className={dt}>tz offset</dt>
            <dd className={dd}>{prefs?.tzOffsetMinutes ?? 0} min</dd>
          </div>
          <div>
            <dt className={dt}>channels subscribed</dt>
            <dd className={dd}>{channelSubs.filter((c) => c.subscribed).length}</dd>
          </div>
        </dl>
      </Section>

      {/* devices */}
      <Section title="devices">
        {devices.length === 0 ? (
          <div className="font-[var(--font-data)] text-[11px] text-[var(--ink-tertiary)]">
            no devices paired
          </div>
        ) : (
          <ul className="space-y-2 font-[var(--font-data)] text-[11px]">
            {devices.map((d) => (
              <li key={d.id} className="flex gap-4 flex-wrap">
                <span className="font-bold">{d.deviceName ?? d.id.slice(0, 8)}</span>
                <span className="text-[var(--ink-tertiary)]">
                  {d.os} / {d.ideType}
                </span>
                <span className="text-[var(--ink-tertiary)]">
                  last heartbeat {relativeTime(d.lastHeartbeat)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* watchlist */}
      <Section title="watchlist">
        {watchlistTickers.length === 0 ? (
          <div className="font-[var(--font-data)] text-[11px] text-[var(--ink-tertiary)]">
            empty
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 font-[var(--font-data)] text-[11px]">
            {watchlistTickers.map((t) => (
              <span key={t.symbol} className="px-2 py-0.5 border border-[var(--rule-default)]">
                <span className="font-bold">{t.symbol}</span>
                <span className="text-[var(--ink-tertiary)] ml-1">{t.assetClass}</span>
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* alerts */}
      <Section title="alerts">
        <div className="space-y-4">
          <div>
            <h3 className="font-[var(--font-display)] text-[10px] tracking-[0.06em] uppercase text-[var(--ink-secondary)] mb-2">
              rules
            </h3>
            {alertRules.length === 0 ? (
              <div className="font-[var(--font-data)] text-[11px] text-[var(--ink-tertiary)]">
                no rules
              </div>
            ) : (
              <ul className="space-y-1 font-[var(--font-data)] text-[11px]">
                {alertRules.map((a) => (
                  <li key={a.id}>
                    {a.scope === "global" ? (
                      "global"
                    ) : (
                      <span className="font-bold">{a.symbol}</span>
                    )}{" "}
                    ±{a.thresholdPct}%
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="font-[var(--font-display)] text-[10px] tracking-[0.06em] uppercase text-[var(--ink-secondary)] mb-2">
              recent fires
            </h3>
            {recentAlertEvents.length === 0 ? (
              <div className="font-[var(--font-data)] text-[11px] text-[var(--ink-tertiary)]">
                no recent fires
              </div>
            ) : (
              <table className="font-[var(--font-data)] text-[11px] tabular-nums">
                <tbody>
                  {recentAlertEvents.map((e) => (
                    <tr key={e.id}>
                      <td className="pr-4 text-[var(--ink-tertiary)]">{relativeTime(e.firedAt)}</td>
                      <td className="pr-4 font-bold">{e.symbol}</td>
                      <td
                        className={
                          e.changePct >= 0 ? "text-[#2F8F4E]" : "text-[var(--status-negative)]"
                        }
                      >
                        {e.changePct >= 0 ? "+" : ""}
                        {e.changePct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Section>

      {/* recent slots */}
      <Section title="recent slots">
        {recentImpressions.length === 0 ? (
          <div className="font-[var(--font-data)] text-[11px] text-[var(--ink-tertiary)]">
            no impressions
          </div>
        ) : (
          <table className="font-[var(--font-data)] text-[11px] tabular-nums w-full max-w-2xl">
            <thead>
              <tr className="text-[var(--ink-tertiary)]">
                {["when", "kind", "source", "duration", "result", "saved"].map((h) => (
                  <th
                    key={h}
                    className={`pb-2 font-[var(--font-display)] text-[9px] tracking-[0.08em] uppercase ${h === "duration" ? "text-right pr-4" : "text-left pr-4"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentImpressions.map((i) => (
                <tr key={i.id}>
                  <td className="pr-4 py-1 text-[var(--ink-tertiary)]">
                    {relativeTime(i.createdAt)}
                  </td>
                  <td className="pr-4 py-1">{i.kind}</td>
                  <td className="pr-4 py-1">{i.source}</td>
                  <td className="pr-4 py-1 text-right">{i.durationMs}ms</td>
                  <td className="pr-4 py-1">{i.result}</td>
                  <td className="py-1">{i.saved ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-[var(--font-display)] text-[10px] tracking-[0.1em] uppercase text-[var(--ink-secondary)] mb-3 pb-2 border-b border-[var(--rule-default)]">
        {title}
      </h2>
      {children}
    </section>
  )
}
