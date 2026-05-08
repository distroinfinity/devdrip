import { StatusDot } from "./status-dot"

interface Props {
  apiBootedAt: string | null
  newsLastFetch: string | null
  tickerLastQuote: string | null
  alertEvalLastTick: string | null
  totalUsers: number
}

function relative(iso: string | null): string {
  if (!iso) return "—"
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 3600_000) return `${Math.round(ms / 60_000)}m ago`
  if (ms < 86400_000) return `${Math.round(ms / 3600_000)}h ago`
  return `${Math.round(ms / 86400_000)}d ago`
}

function status(iso: string | null, staleMs: number): "green" | "amber" | "red" {
  if (!iso) return "red"
  const age = Date.now() - new Date(iso).getTime()
  if (age > staleMs) return "amber"
  return "green"
}

export function SystemStateReadout({
  apiBootedAt,
  newsLastFetch,
  tickerLastQuote,
  alertEvalLastTick,
  totalUsers,
}: Props) {
  const dt =
    "font-[var(--font-display)] text-[9px] font-bold tracking-[0.1em] uppercase text-[var(--ink-tertiary)]"
  return (
    <dl className="font-[var(--font-data)] text-[10.5px] leading-[1.85] text-[var(--ink-secondary)] mt-1.5 pt-4 border-t border-[var(--rule-default)]">
      <dt className={dt}>api</dt>
      <dd className="m-0 flex items-center gap-2">
        <StatusDot status={status(apiBootedAt, 3 * 60_000)} /> {relative(apiBootedAt)}
      </dd>
      <dt className={`${dt} mt-3`}>news fetch</dt>
      <dd className="m-0 flex items-center gap-2">
        <StatusDot status={status(newsLastFetch, 10 * 60_000)} /> {relative(newsLastFetch)}
      </dd>
      <dt className={`${dt} mt-3`}>ticker fetch</dt>
      <dd className="m-0 flex items-center gap-2">
        <StatusDot status={status(tickerLastQuote, 5 * 60_000)} /> {relative(tickerLastQuote)}
      </dd>
      <dt className={`${dt} mt-3`}>alerts</dt>
      <dd className="m-0 flex items-center gap-2">
        <StatusDot status={status(alertEvalLastTick, 5 * 60_000)} /> {relative(alertEvalLastTick)}
      </dd>
      <dt className={`${dt} mt-3`}>users</dt>
      <dd className="m-0 tabular-nums">{totalUsers}</dd>
    </dl>
  )
}
