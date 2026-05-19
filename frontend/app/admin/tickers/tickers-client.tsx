"use client"

import { useState } from "react"
import type { TickerSymbolRow, TickerSymbolCreate } from "@/lib/admin-api"
import { DataTable, type ColumnDef } from "@/components/admin/data-table"
import { StatusDot } from "@/components/admin/status-dot"
import { InlineEditPanel } from "@/components/admin/inline-edit-panel"
import { SharpButton } from "@/components/v5/sharp-button"
import { SharpInput } from "@/components/v5/sharp-input"
import { SegmentedPill } from "@/components/v5/segmented-pill"
import { EmptyState } from "@/components/v5/empty-state"
import {
  createTickerSymbolAction,
  updateTickerSymbolAction,
  deleteTickerSymbolAction,
} from "@/app/admin/actions"

interface Props {
  initial: TickerSymbolRow[]
}

type EditState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; row: TickerSymbolRow }

const ASSET_CLASSES: Array<{ value: "equity" | "crypto"; label: string }> = [
  { value: "equity", label: "equity" },
  { value: "crypto", label: "crypto" },
]

const PROVIDERS: Array<{ value: "finnhub" | "coingecko"; label: string }> = [
  { value: "finnhub", label: "finnhub" },
  { value: "coingecko", label: "coingecko" },
]

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`
  return `${Math.round(ms / 86_400_000)}d ago`
}

const DEFAULT_FORM: Partial<TickerSymbolCreate> = {
  symbol: "",
  assetClass: "equity",
  provider: "finnhub",
  providerId: "",
  enabled: true,
}

export function TickersClient({ initial }: Props) {
  const [edit, setEdit] = useState<EditState>({ mode: "closed" })
  const [form, setForm] = useState<Partial<TickerSymbolCreate>>(DEFAULT_FORM)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function startCreate() {
    setForm({ ...DEFAULT_FORM })
    setEdit({ mode: "create" })
  }

  function startEdit(row: TickerSymbolRow) {
    setForm({
      symbol: row.symbol,
      assetClass: row.assetClass,
      provider: row.provider,
      providerId: row.providerId,
      enabled: row.enabled,
    })
    setEdit({ mode: "edit", row })
  }

  async function save() {
    if (edit.mode === "create") {
      await createTickerSymbolAction(form as TickerSymbolCreate)
    } else if (edit.mode === "edit") {
      await updateTickerSymbolAction(edit.row.symbol, form)
    }
    setEdit({ mode: "closed" })
  }

  async function toggleEnabled(row: TickerSymbolRow) {
    await updateTickerSymbolAction(row.symbol, { enabled: !row.enabled })
  }

  async function doDelete(symbol: string) {
    await deleteTickerSymbolAction(symbol)
    setConfirmDelete(null)
  }

  const columns: ColumnDef<TickerSymbolRow>[] = [
    {
      key: "status",
      header: "",
      width: "20px",
      render: (r) => <StatusDot status={r.enabled ? "green" : "red"} />,
    },
    {
      key: "symbol",
      header: "symbol",
      width: "80px",
      render: (r) => (
        <span className="font-[var(--font-display)] font-bold tracking-[0.04em]">{r.symbol}</span>
      ),
    },
    {
      key: "assetClass",
      header: "class",
      width: "60px",
      render: (r) => <span className="text-[var(--ink-tertiary)]">{r.assetClass}</span>,
    },
    {
      key: "provider",
      header: "provider",
      width: "90px",
      render: (r) => r.provider,
    },
    {
      key: "providerId",
      header: "provider id",
      width: "1fr",
      render: (r) => (
        <span className="text-[var(--ink-tertiary)] text-[10px] truncate block">
          {r.providerId}
        </span>
      ),
    },
    {
      key: "updatedAt",
      header: "updated",
      width: "90px",
      align: "right",
      render: (r) => (
        <span className="text-[var(--ink-tertiary)]">{relativeTime(r.updatedAt)}</span>
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
          {confirmDelete === r.symbol ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  void doDelete(r.symbol)
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
                  setConfirmDelete(r.symbol)
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
          ticker symbols
        </h1>
        <SharpButton variant="primary" onClick={startCreate}>
          + add ticker
        </SharpButton>
      </div>

      <InlineEditPanel
        open={edit.mode !== "closed"}
        title={
          edit.mode === "create"
            ? "new ticker"
            : edit.mode === "edit"
              ? `edit ${edit.row.symbol}`
              : ""
        }
        onClose={() => setEdit({ mode: "closed" })}
        onSave={save}
      >
        <FormField label="symbol">
          <SharpInput
            value={form.symbol ?? ""}
            onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
            placeholder="AAPL"
            className="w-full uppercase"
          />
        </FormField>
        <FormField label="asset class">
          <SegmentedPill
            options={ASSET_CLASSES}
            value={form.assetClass ?? "equity"}
            onChange={(v) => setForm({ ...form, assetClass: v })}
          />
        </FormField>
        <FormField label="provider">
          <SegmentedPill
            options={PROVIDERS}
            value={form.provider ?? "finnhub"}
            onChange={(v) => setForm({ ...form, provider: v })}
          />
        </FormField>
        <FormField label="provider id">
          <SharpInput
            value={form.providerId ?? ""}
            onChange={(e) => setForm({ ...form, providerId: e.target.value })}
            placeholder="e.g. bitcoin (coingecko) or AAPL (finnhub)"
            className="w-full"
          />
        </FormField>
      </InlineEditPanel>

      <DataTable
        rows={initial}
        columns={columns}
        rowKey={(r) => r.symbol}
        emptyState={
          <EmptyState title="no ticker symbols yet" body="add one to start tracking prices" />
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
