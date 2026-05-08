"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { UserListRow } from "@/lib/admin-api"
import { DataTable, type ColumnDef } from "@/components/admin/data-table"
import { SharpInput } from "@/components/v5/sharp-input"
import { EmptyState } from "@/components/v5/empty-state"

interface Props {
  initial: UserListRow[]
  total: number
  page: number
  limit: number
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—"
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`
  return `${Math.round(ms / 86_400_000)}d ago`
}

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

export function UsersListClient({ initial, total, page, limit }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState("")

  const filtered = filter
    ? initial.filter((u) => (u.email ?? u.id).toLowerCase().includes(filter.toLowerCase()))
    : initial

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const columns: ColumnDef<UserListRow>[] = [
    {
      key: "email",
      header: "email",
      width: "minmax(180px, 1fr)",
      render: (u) =>
        u.email ?? <span className="text-[var(--ink-tertiary)]">{u.id.slice(0, 8)}…</span>,
    },
    {
      key: "createdAt",
      header: "joined",
      width: "100px",
      render: (u) => formatDate(u.createdAt),
    },
    {
      key: "lastActivity",
      header: "last active",
      width: "100px",
      render: (u) => relativeTime(u.lastActivity),
    },
    {
      key: "mode",
      header: "mode",
      width: "100px",
      render: (u) => u.mode ?? "—",
    },
    {
      key: "channels",
      header: "ch",
      width: "40px",
      align: "right",
      render: (u) => u.channelCount,
    },
    {
      key: "watchlist",
      header: "wl",
      width: "40px",
      align: "right",
      render: (u) => u.watchlistSize,
    },
    {
      key: "devices",
      header: "dev",
      width: "40px",
      align: "right",
      render: (u) => u.deviceCount,
    },
    {
      key: "alerts",
      header: "alerts/7d",
      width: "70px",
      align: "right",
      render: (u) => (
        <span className={u.alertsFired7d >= 5 ? "text-[var(--status-negative)]" : ""}>
          {u.alertsFired7d}
        </span>
      ),
    },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[var(--font-display)] text-[18px] font-bold tracking-[-0.02em]">
          users
        </h1>
        <span className="font-[var(--font-data)] text-[10px] text-[var(--ink-tertiary)] tabular-nums">
          {total.toLocaleString()} total
        </span>
      </div>

      <div className="mb-4">
        <SharpInput
          placeholder="filter by email"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-64"
        />
      </div>

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(u) => u.id}
        onRowClick={(u) => router.push(`/admin/users/${u.id}`)}
        emptyState={<EmptyState title={filter ? "no matches" : "no users yet"} />}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 font-[var(--font-data)] text-[10px] text-[var(--ink-tertiary)]">
          <span>
            page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`?page=${page - 1}`}
                className="px-3 py-1 border border-[var(--rule-default)] hover:text-[var(--ink-primary)]"
              >
                prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`?page=${page + 1}`}
                className="px-3 py-1 border border-[var(--rule-default)] hover:text-[var(--ink-primary)]"
              >
                next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
