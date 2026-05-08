"use client"

import Link from "next/link"
import type { AuditEventDto } from "@/lib/admin-api"
import { DataTable, type ColumnDef } from "@/components/admin/data-table"
import { EmptyState } from "@/components/v5/empty-state"

const FILTERS: Array<{ label: string; sinceSec: number | null }> = [
  { label: "all", sinceSec: null },
  { label: "24h", sinceSec: 24 * 60 * 60 },
  { label: "7d", sinceSec: 7 * 24 * 60 * 60 },
  { label: "30d", sinceSec: 30 * 24 * 60 * 60 },
]

function buildHref(sinceSec: number | null): string {
  if (sinceSec === null) return "?"
  const sinceISO = new Date(Date.now() - sinceSec * 1000).toISOString()
  return `?since=${encodeURIComponent(sinceISO)}`
}

// determine active chip: match "all" when no since param, otherwise find the
// filter whose expected cutoff is within 1 minute of the since param value.
// loose tolerance handles the server-side render delay between buildHref and
// page load. if no filter matches, defaults to "all" (index 0).
function activeFilterIndex(since: string | undefined): number {
  if (!since) return 0
  const actual = new Date(since).getTime()
  const idx = FILTERS.findIndex((f) => {
    if (!f.sinceSec) return false
    const expected = Date.now() - f.sinceSec * 1000
    return Math.abs(expected - actual) < 60_000
  })
  return idx >= 0 ? idx : 0
}

export function AuditClient({ events, since }: { events: AuditEventDto[]; since?: string }) {
  const activeIdx = activeFilterIndex(since)

  const columns: ColumnDef<AuditEventDto>[] = [
    {
      key: "firedAt",
      header: "when",
      width: "150px",
      render: (e) => new Date(e.firedAt).toISOString().replace("T", " ").slice(0, 19),
    },
    {
      key: "email",
      header: "user",
      width: "minmax(180px, 1fr)",
      render: (e) =>
        e.email ? (
          <Link
            href={`/admin/users/${e.userId}`}
            className="hover:text-[var(--accent-color)]"
            onClick={(ev) => ev.stopPropagation()}
          >
            {e.email}
          </Link>
        ) : (
          <Link
            href={`/admin/users/${e.userId}`}
            className="text-[var(--ink-tertiary)] hover:text-[var(--accent-color)]"
            onClick={(ev) => ev.stopPropagation()}
          >
            {e.userId.slice(0, 8)}…
          </Link>
        ),
    },
    {
      key: "symbol",
      header: "symbol",
      width: "80px",
      render: (e) => <span className="font-bold">{e.symbol}</span>,
    },
    {
      key: "changePct",
      header: "change",
      width: "80px",
      align: "right",
      render: (e) => (
        <span className={e.changePct >= 0 ? "text-[#2F8F4E]" : "text-[var(--status-negative)]"}>
          {e.changePct >= 0 ? "+" : ""}
          {e.changePct.toFixed(1)}%
        </span>
      ),
    },
    {
      key: "thresholdPct",
      header: "threshold",
      width: "80px",
      align: "right",
      render: (e) => `±${e.thresholdPct.toFixed(1)}%`,
    },
    {
      key: "deviceId",
      header: "device",
      width: "100px",
      render: (e) => (
        <span className="text-[var(--ink-tertiary)]">
          {e.deviceId ? `${e.deviceId.slice(0, 8)}…` : "—"}
        </span>
      ),
    },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[var(--font-display)] text-[18px] font-bold tracking-[-0.02em]">
          audit log
        </h1>
        <span className="font-[var(--font-data)] text-[10px] text-[var(--ink-tertiary)] tabular-nums">
          {events.length} events
        </span>
      </div>

      <div className="flex gap-1 mb-4 font-[var(--font-display)] text-[10px] tracking-[0.06em] uppercase">
        {FILTERS.map((f, i) => (
          <Link
            key={f.label}
            href={buildHref(f.sinceSec)}
            className={`px-3 py-1 border ${
              i === activeIdx
                ? "border-[var(--ink-primary)] bg-[var(--ink-primary)] text-[var(--bg-primary)]"
                : "border-[var(--rule-default)] text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <DataTable
        rows={events}
        columns={columns}
        rowKey={(e) => e.id}
        emptyState={
          <EmptyState
            title="no alert events"
            body="alerts trigger when a watched ticker moves more than the user's threshold"
          />
        }
      />
    </div>
  )
}
