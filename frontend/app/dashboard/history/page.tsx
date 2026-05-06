import { BlurFade } from "@distrotv/design-system/components/blur-fade"
import { apiFetchOrRefresh } from "@/lib/api"
import type { ImpressionListResponse, ListImpressionsFilters } from "@/lib/dashboard-api"
import { HistoryFilters } from "@/components/dashboard/history/history-filters"
import { HistoryTable } from "@/components/dashboard/history/history-table"
import { EmptyHistory } from "@/components/dashboard/history/empty-history"

export const dynamic = "force-dynamic"

interface HistoryPageProps {
  searchParams?: Record<string, string | string[] | undefined>
}

function pickString(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string" && v.length > 0) return v
  if (Array.isArray(v) && typeof v[0] === "string") return v[0]
  return undefined
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const filters: ListImpressionsFilters = {
    from: pickString(searchParams?.["from"]),
    to: pickString(searchParams?.["to"]),
    source: pickString(searchParams?.["source"]),
    result: pickString(searchParams?.["result"]),
    category: pickString(searchParams?.["category"]),
    limit: 50,
  }

  const qs = buildQuery({ ...filters })
  const initial = await apiFetchOrRefresh<ImpressionListResponse>(
    `/me/impressions${qs}`,
    "/dashboard/history"
  )

  const filtered = Boolean(filters.from || filters.to || filters.source || filters.result)
  const isEmpty = initial.items.length === 0

  // CSV download routes through a same-origin Next handler that attaches the
  // httpOnly bearer cookie. See app/api/me/impressions/export.csv/route.ts.
  const csvHref = `/api/me/impressions/export.csv${qs}`

  return (
    <div className="flex flex-col gap-6">
      <BlurFade delay={0} direction="up" offset={6}>
        <div>
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
            History
          </p>
          <h1 className="mt-2 font-display text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--ink-primary)] md:text-[40px]">
            every ad you&apos;ve seen
          </h1>
          <p className="mt-2 font-body text-[13px] text-[var(--ink-secondary)]">
            filter, inspect, export. each row is a real impression we recorded for you.
          </p>
        </div>
      </BlurFade>

      <BlurFade delay={0.04} direction="up" offset={6}>
        <HistoryFilters csvHref={csvHref} />
      </BlurFade>

      <BlurFade delay={0.08} direction="up" offset={6}>
        {isEmpty ? (
          <EmptyHistory filtered={filtered} />
        ) : (
          <HistoryTable initial={initial} filters={filters} />
        )}
      </BlurFade>
    </div>
  )
}

function buildQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue
    sp.set(k, String(v))
  }
  return sp.toString() ? `?${sp.toString()}` : ""
}
