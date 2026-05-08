"use client"

import { useState } from "react"
import type { NewsSourceRow, NewsSourceCreate } from "@/lib/admin-api"
import { DataTable, type ColumnDef } from "@/components/admin/data-table"
import { StatusDot } from "@/components/admin/status-dot"
import { InlineEditPanel } from "@/components/admin/inline-edit-panel"
import { SharpButton } from "@/components/v5/sharp-button"
import { SharpInput } from "@/components/v5/sharp-input"
import { EmptyState } from "@/components/v5/empty-state"
import {
  createNewsSourceAction,
  updateNewsSourceAction,
  deleteNewsSourceAction,
} from "@/app/admin/actions"

interface Props {
  initial: NewsSourceRow[]
}

type EditState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; row: NewsSourceRow }

function sourceStatus(row: NewsSourceRow): "green" | "amber" | "red" {
  if (!row.enabled || !row.healthy) return "red"
  if (!row.lastFetchedAt) return "amber"
  const age = Date.now() - new Date(row.lastFetchedAt).getTime()
  if (age > row.fetchIntervalMin * 60 * 1000 * 2) return "amber"
  return "green"
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never"
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`
  return `${Math.round(ms / 86_400_000)}d ago`
}

export function SourcesClient({ initial }: Props) {
  const [edit, setEdit] = useState<EditState>({ mode: "closed" })
  const [form, setForm] = useState<Partial<NewsSourceCreate>>({})
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function startCreate() {
    setForm({})
    setEdit({ mode: "create" })
  }

  function startEdit(row: NewsSourceRow) {
    setForm({
      channelId: row.channelId,
      key: row.key,
      kind: row.kind,
      url: row.url,
      halfLifeHours: row.halfLifeHours,
      fetchIntervalMin: row.fetchIntervalMin,
      enabled: row.enabled,
    })
    setEdit({ mode: "edit", row })
  }

  async function save() {
    if (edit.mode === "create") {
      await createNewsSourceAction(form as NewsSourceCreate)
    } else if (edit.mode === "edit") {
      await updateNewsSourceAction(edit.row.id, form)
    }
    setEdit({ mode: "closed" })
  }

  async function toggleEnabled(row: NewsSourceRow) {
    await updateNewsSourceAction(row.id, { enabled: !row.enabled })
  }

  async function doDelete(id: string) {
    await deleteNewsSourceAction(id)
    setConfirmDelete(null)
  }

  const columns: ColumnDef<NewsSourceRow>[] = [
    {
      key: "status",
      header: "",
      width: "20px",
      render: (r) => <StatusDot status={sourceStatus(r)} />,
    },
    {
      key: "key",
      header: "key",
      width: "120px",
      render: (r) => <span className="font-bold">{r.key}</span>,
    },
    {
      key: "kind",
      header: "kind",
      width: "60px",
      render: (r) => r.kind,
    },
    {
      key: "url",
      header: "url",
      width: "1fr",
      render: (r) => (
        <span className="text-[var(--ink-tertiary)] text-[10px] truncate block">{r.url}</span>
      ),
    },
    {
      key: "halfLife",
      header: "half-life",
      width: "70px",
      align: "right",
      render: (r) => `${r.halfLifeHours}h`,
    },
    {
      key: "interval",
      header: "interval",
      width: "70px",
      align: "right",
      render: (r) => `${r.fetchIntervalMin}m`,
    },
    {
      key: "lastFetch",
      header: "last fetch",
      width: "100px",
      align: "right",
      render: (r) => (
        <span style={{ color: r.lastError ? "var(--status-negative)" : undefined }}>
          {relativeTime(r.lastFetchedAt)}
        </span>
      ),
    },
    {
      key: "enabled",
      header: "enabled",
      width: "60px",
      align: "center",
      render: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            void toggleEnabled(r)
          }}
          className={`px-2 py-0.5 text-[9px] font-[var(--font-display)] tracking-[0.06em] uppercase border ${
            r.enabled
              ? "border-[var(--accent-color)] text-[var(--accent-color)]"
              : "border-[var(--rule-default)] text-[var(--ink-tertiary)]"
          }`}
        >
          {r.enabled ? "ON" : "OFF"}
        </button>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "140px",
      align: "right",
      render: (r) => (
        <div className="flex gap-2 justify-end">
          {confirmDelete === r.id ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  void doDelete(r.id)
                }}
                className="text-[10px] border px-2 py-0.5"
                style={{ color: "var(--status-negative)", borderColor: "var(--status-negative)" }}
              >
                confirm
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmDelete(null)
                }}
                className="text-[10px] text-[var(--ink-tertiary)] border border-[var(--rule-default)] px-2 py-0.5"
              >
                cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  startEdit(r)
                }}
                className="text-[10px] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] border border-[var(--rule-default)] px-2 py-0.5"
              >
                edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmDelete(r.id)
                }}
                className="text-[10px] text-[var(--ink-tertiary)] hover:text-[var(--status-negative)] border border-[var(--rule-default)] px-2 py-0.5"
              >
                delete
              </button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[var(--font-display)] text-[18px] font-bold tracking-[-0.02em]">
          news sources
        </h1>
        <SharpButton variant="primary" onClick={startCreate}>
          + add source
        </SharpButton>
      </div>

      <InlineEditPanel
        open={edit.mode !== "closed"}
        title={
          edit.mode === "create" ? "new source" : edit.mode === "edit" ? `edit ${edit.row.key}` : ""
        }
        onClose={() => setEdit({ mode: "closed" })}
        onSave={save}
      >
        <FormField label="channel id">
          <SharpInput
            value={form.channelId ?? ""}
            onChange={(e) => setForm({ ...form, channelId: e.target.value })}
            placeholder="uuid"
            className="w-full"
          />
        </FormField>
        <FormField label="key">
          <SharpInput
            value={form.key ?? ""}
            onChange={(e) => setForm({ ...form, key: e.target.value })}
            placeholder="hn-top"
            className="w-full"
          />
        </FormField>
        <FormField label="kind">
          <SharpInput
            value={form.kind ?? ""}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}
            placeholder="hn | rss | reddit"
            className="w-full"
          />
        </FormField>
        <FormField label="url">
          <SharpInput
            value={form.url ?? ""}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://..."
            className="w-full"
          />
        </FormField>
        <div className="flex gap-3">
          <FormField label="half-life (hours)">
            <SharpInput
              type="number"
              value={form.halfLifeHours ?? ""}
              onChange={(e) => setForm({ ...form, halfLifeHours: Number(e.target.value) })}
              className="w-32"
            />
          </FormField>
          <FormField label="fetch interval (min)">
            <SharpInput
              type="number"
              value={form.fetchIntervalMin ?? ""}
              onChange={(e) => setForm({ ...form, fetchIntervalMin: Number(e.target.value) })}
              className="w-32"
            />
          </FormField>
        </div>
      </InlineEditPanel>

      <DataTable
        rows={initial}
        columns={columns}
        rowKey={(r) => r.id}
        emptyState={
          <EmptyState title="no news sources yet" body="add one to start fetching news" />
        }
      />
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-[var(--font-display)] text-[9px] tracking-[0.08em] uppercase text-[var(--ink-tertiary)] mb-1">
        {label}
      </label>
      {children}
    </div>
  )
}
