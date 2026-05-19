import { adminApi, type OverviewDto, type SystemHealthDto } from "@/lib/admin-api"
import { StatusDot } from "@/components/admin/status-dot"
import Link from "next/link"

export default async function AdminOverview() {
  const [overview, systemHealth] = await Promise.all([adminApi.overview(), adminApi.systemHealth()])

  return (
    <div className="p-8">
      {/* 3-column header strip */}
      <div className="grid grid-cols-3 gap-0 border border-[var(--rule-default)] bg-[var(--bg-surface)] mb-6">
        <HeaderStat label="users" value={overview.counts.users} />
        <HeaderStat label="slots / 7d" value={overview.counts.slots7d} divider />
        <HeaderStat label="alerts / 7d" value={overview.counts.alerts7d} divider />
      </div>

      {/* 2×2 grid */}
      <div className="grid grid-cols-2 gap-4">
        <SystemHealthCard
          sources={systemHealth.newsSources}
          providers={systemHealth.tickerProviders}
        />
        <SignupsCard byDay={overview.signupsLast7d.byDay} recent={overview.signupsLast7d.recent} />
        <ModeDistributionCard
          distribution={overview.modeDistribution}
          totalUsers={overview.counts.users}
        />
        <RecentAlertsCard alerts={overview.recentAlerts} />
      </div>

      {/* footer */}
      <div className="mt-6 pt-4 border-t border-[var(--rule-default)] font-[var(--font-data)] text-[10px] text-[var(--ink-tertiary)] tabular-nums">
        ▸ {overview.counts.users} users · {overview.counts.slots7d} slots / 7d ·{" "}
        {overview.counts.alerts7d} alerts / 7d
      </div>
    </div>
  )
}

function HeaderStat({
  label,
  value,
  divider,
}: {
  label: string
  value: number
  divider?: boolean
}) {
  return (
    <div className={`px-6 py-5 ${divider ? "border-l border-[var(--rule-default)]" : ""}`}>
      <div className="font-[var(--font-display)] text-[32px] font-bold tracking-[-0.02em] text-[var(--ink-primary)] tabular-nums">
        {value.toLocaleString()}
      </div>
      <div className="font-[var(--font-data)] text-[10px] text-[var(--ink-tertiary)] tracking-[0.08em] uppercase mt-1">
        {label}
      </div>
    </div>
  )
}

function CardShell({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="border border-[var(--rule-default)] bg-[var(--bg-surface)]">
      <div className="px-4 py-3 border-b border-[var(--rule-default)] flex items-center justify-between">
        <span className="font-[var(--font-display)] text-[10px] tracking-[0.1em] uppercase text-[var(--ink-secondary)] font-bold">
          {title}
        </span>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function SystemHealthCard({
  sources,
  providers,
}: {
  sources: SystemHealthDto["newsSources"]
  providers: SystemHealthDto["tickerProviders"]
}) {
  return (
    <CardShell title="system health">
      <div className="space-y-2 font-[var(--font-data)] text-[11px]">
        <div className="font-[var(--font-display)] text-[9px] tracking-[0.08em] uppercase text-[var(--ink-tertiary)]">
          news sources
        </div>
        {sources.length === 0 && (
          <div className="text-[10px] text-[var(--ink-tertiary)]">no sources configured</div>
        )}
        {sources.map((s) => (
          <div key={s.id} className="flex items-center gap-3">
            <StatusDot status={s.status} />
            <span className="font-bold text-[11px]">{s.key}</span>
            <span className="text-[var(--ink-tertiary)] flex-1 truncate">
              {s.lastFetchedAt ? `last fetch ${relativeTime(s.lastFetchedAt)}` : "never fetched"}
            </span>
          </div>
        ))}
        <div className="font-[var(--font-display)] text-[9px] tracking-[0.08em] uppercase text-[var(--ink-tertiary)] pt-2">
          tickers
        </div>
        {providers.length === 0 && (
          <div className="text-[10px] text-[var(--ink-tertiary)]">no providers configured</div>
        )}
        {providers.map((p) => (
          <div key={p.provider} className="flex items-center gap-3">
            <StatusDot status={p.status} />
            <span className="font-bold text-[11px]">{p.provider}</span>
            <span className="text-[var(--ink-tertiary)] flex-1">
              {p.enabledSymbolCount} symbols ·{" "}
              {p.lastQuoteAt ? `last quote ${relativeTime(p.lastQuoteAt)}` : "no quote"}
            </span>
          </div>
        ))}
      </div>
    </CardShell>
  )
}

function SignupsCard({
  byDay,
  recent,
}: {
  byDay: OverviewDto["signupsLast7d"]["byDay"]
  recent: OverviewDto["signupsLast7d"]["recent"]
}) {
  const max = Math.max(1, ...byDay.map((d) => d.count))
  return (
    <CardShell title="signups · 7d">
      {/* bar chart */}
      <div className="flex items-end gap-1 h-12 mb-3">
        {byDay.length === 0 ? (
          <div className="text-[10px] text-[var(--ink-tertiary)]">no signups in last 7d</div>
        ) : (
          byDay.map((d) => (
            <div
              key={d.day}
              className="flex-1 bg-[var(--accent-color)]"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: 1 }}
              title={`${d.day}: ${d.count}`}
            />
          ))
        )}
      </div>
      {/* recent list */}
      <div className="space-y-1 font-[var(--font-data)] text-[10px]">
        {recent.length === 0 && <div className="text-[var(--ink-tertiary)]">no recent signups</div>}
        {recent.slice(0, 5).map((r) => (
          <Link
            key={r.id}
            href={`/users/${r.id}`}
            className="flex justify-between hover:bg-[var(--bg-surface-hover)] px-1 py-0.5"
          >
            <span className="truncate">{r.email ?? r.id.slice(0, 8)}</span>
            <span className="text-[var(--ink-tertiary)] tabular-nums">
              {relativeTime(r.createdAt)}
            </span>
          </Link>
        ))}
      </div>
    </CardShell>
  )
}

function ModeDistributionCard({
  distribution,
  totalUsers,
}: {
  distribution: OverviewDto["modeDistribution"]
  totalUsers: number
}) {
  const total = totalUsers || distribution.reduce((s, d) => s + d.count, 0) || 1
  const colors = ["#A5B4FC", "#818CF8", "#6366F1", "#4F46E5", "#4338CA"]
  return (
    <CardShell title="mode distribution">
      <div className="flex h-3 mb-3 overflow-hidden">
        {distribution.map((d, i) => (
          <div
            key={d.mode}
            title={`${d.mode}: ${d.count}`}
            style={{
              width: `${(d.count / total) * 100}%`,
              backgroundColor: colors[i % colors.length],
            }}
          />
        ))}
      </div>
      {distribution.length === 0 && (
        <div className="text-[10px] text-[var(--ink-tertiary)]">no data</div>
      )}
      <div className="space-y-1 font-[var(--font-data)] text-[10px] tabular-nums">
        {distribution.map((d, i) => (
          <div key={d.mode} className="flex items-center gap-2">
            <span
              style={{
                width: 8,
                height: 8,
                backgroundColor: colors[i % colors.length],
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span className="font-bold">{d.mode}</span>
            <span className="flex-1 text-[var(--ink-tertiary)]">
              {Math.round((d.count / total) * 100)}%
            </span>
            <span>{d.count}</span>
          </div>
        ))}
      </div>
    </CardShell>
  )
}

function RecentAlertsCard({ alerts }: { alerts: OverviewDto["recentAlerts"] }) {
  return (
    <CardShell title="recent alerts">
      {alerts.length === 0 ? (
        <div className="text-[10px] text-[var(--ink-tertiary)]">no alerts fired</div>
      ) : (
        <div className="space-y-1 font-[var(--font-data)] text-[10px] tabular-nums">
          {alerts.slice(0, 8).map((a) => (
            <Link
              key={a.id}
              href={`/users/${a.userId}`}
              className="grid grid-cols-[60px_1fr_60px] gap-2 hover:bg-[var(--bg-surface-hover)] px-1 py-0.5"
            >
              <span className="text-[var(--ink-tertiary)]">{relativeTime(a.firedAt)}</span>
              <span className="font-bold">{a.symbol}</span>
              <span
                className="text-right"
                style={{ color: a.changePct >= 0 ? "#2F8F4E" : "var(--status-negative)" }}
              >
                {a.changePct >= 0 ? "+" : ""}
                {a.changePct.toFixed(1)}%
              </span>
            </Link>
          ))}
        </div>
      )}
    </CardShell>
  )
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`
  return `${Math.round(ms / 86_400_000)}d ago`
}
