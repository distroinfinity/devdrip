"use client"

import { useEffect, useState, useTransition } from "react"
import { cn } from "@devdrip/design-system/utils"
import { categoryLabel } from "@/lib/categories"
import { formatDateTimeShort, formatDurationMs, formatUsdPrecise } from "@/lib/format"
import type {
  ImpressionDetail,
  ImpressionListItem,
  ImpressionListResponse,
  ListImpressionsFilters,
} from "@/lib/dashboard-api"
import { fetchImpressionDetail, loadMoreImpressions } from "@/app/dashboard/history/actions"
import { ImpressionDrawer } from "./row-drawer"

interface HistoryTableProps {
  initial: ImpressionListResponse
  filters: ListImpressionsFilters
}

export function HistoryTable({ initial, filters }: HistoryTableProps) {
  const [items, setItems] = useState<ImpressionListItem[]>(initial.items)
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor)
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ImpressionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [loadMorePending, startLoadMore] = useTransition()

  // filters are part of the URL — when the page re-fetches with new filters,
  // initial changes; reset our locally-accumulated rows.
  useEffect(() => {
    setItems(initial.items)
    setCursor(initial.nextCursor)
  }, [initial])

  function openDrawer(id: string): void {
    setOpenId(id)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    fetchImpressionDetail(id)
      .then((d) => {
        setDetail(d)
      })
      .catch((err: Error) => {
        setDetailError(err.message)
      })
      .finally(() => setDetailLoading(false))
  }

  function closeDrawer(): void {
    setOpenId(null)
    setDetail(null)
    setDetailError(null)
  }

  function loadMore(): void {
    if (!cursor || loadMorePending) return
    startLoadMore(async () => {
      const next = await loadMoreImpressions({ ...filters, cursor })
      setItems((prev) => [...prev, ...next.items])
      setCursor(next.nextCursor)
    })
  }

  return (
    <>
      <section className="overflow-hidden rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--rule-default)]">
                <Th>When</Th>
                <Th>Advertiser</Th>
                <Th>Source</Th>
                <Th>Category</Th>
                <Th align="right">Duration</Th>
                <Th>Outcome</Th>
                <Th align="right">Earned</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => openDrawer(row.id)}
                  className="cursor-pointer border-b border-[var(--rule-subtle)] transition-colors last:border-b-0 hover:bg-[var(--bg-surface-hover)]"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      openDrawer(row.id)
                    }
                  }}
                >
                  <Td>
                    <span className="font-data text-[12px] tabular-nums text-[var(--ink-primary)]">
                      {formatDateTimeShort(row.createdAt)}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-[13px] text-[var(--ink-primary)]">
                      {row.advertiserName ?? (
                        <em className="text-[var(--ink-tertiary)]">unknown</em>
                      )}
                    </span>
                    {row.campaignName && (
                      <div className="mt-0.5 font-body text-[11px] text-[var(--ink-tertiary)]">
                        {row.campaignName}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <SourceBadge source={row.source} />
                  </Td>
                  <Td>
                    <span className="font-body text-[12px] text-[var(--ink-secondary)]">
                      {row.category ? categoryLabel(row.category) : "—"}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="font-data text-[12px] tabular-nums text-[var(--ink-secondary)]">
                      {formatDurationMs(row.durationMs)}
                    </span>
                  </Td>
                  <Td>
                    <ResultPill result={row.result} hasClick={row.hasClick} />
                  </Td>
                  <Td align="right">
                    <span
                      className={cn(
                        "font-data text-[13px] font-medium tabular-nums",
                        row.earnedAmount > 0
                          ? "text-[var(--ink-primary)]"
                          : "text-[var(--ink-tertiary)]"
                      )}
                    >
                      {row.earnedAmount > 0 ? formatUsdPrecise(row.earnedAmount) : "—"}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {cursor && (
          <div className="border-t border-[var(--rule-default)] px-4 py-3 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadMorePending}
              className="font-display text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-secondary)] transition-colors hover:text-[var(--ink-primary)] disabled:opacity-50"
            >
              {loadMorePending ? "loading…" : "load more →"}
            </button>
          </div>
        )}
      </section>

      <ImpressionDrawer
        open={openId !== null}
        loading={detailLoading}
        error={detailError}
        detail={detail}
        onClose={closeDrawer}
      />
    </>
  )
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className={cn(
        "px-4 py-3 font-display text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-tertiary)]",
        align === "right" ? "text-right" : "text-left"
      )}
    >
      {children}
    </th>
  )
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td className={cn("px-4 py-3 align-top", align === "right" ? "text-right" : "text-left")}>
      {children}
    </td>
  )
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span className="inline-flex items-center rounded-pill border border-[var(--rule-default)] bg-[var(--bg-inset)] px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--ink-secondary)]">
      {source}
    </span>
  )
}

function ResultPill({ result, hasClick }: { result: string; hasClick: boolean }) {
  const palette: Record<string, string> = {
    completed: "border-[var(--accent-color)]/40 bg-[var(--accent-glow)] text-[var(--accent-color)]",
    skipped: "border-[var(--rule-default)] bg-[var(--bg-inset)] text-[var(--ink-tertiary)]",
    expired: "border-[var(--rule-default)] bg-[var(--bg-inset)] text-[var(--ink-tertiary)]",
    interrupted:
      "border-[var(--rule-strong)] bg-[var(--status-caution-surface)] text-[var(--status-caution)]",
  }
  const cls = palette[result] ?? palette["skipped"]
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          "inline-flex items-center rounded-pill border px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-[0.12em]",
          cls
        )}
      >
        {result}
      </span>
      {hasClick && (
        <span
          className="inline-flex items-center rounded-pill border border-[var(--accent-color)]/40 bg-[var(--accent-glow)] px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--accent-color)]"
          title="discovered (clicked through)"
        >
          ★
        </span>
      )}
    </span>
  )
}
