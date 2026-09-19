"use client"

import { useEffect, useState } from "react"
import { cn } from "@devdrip/design-system/utils"
import { categoryLabel } from "@/lib/categories"
import { formatDateTimeShort, formatDurationMs, formatUsdPrecise } from "@/lib/format"
import type { ImpressionDetail } from "@/lib/dashboard-api"

interface ImpressionDrawerProps {
  open: boolean
  loading: boolean
  error: string | null
  detail: ImpressionDetail | null
  onClose: () => void
}

export function ImpressionDrawer({ open, loading, error, detail, onClose }: ImpressionDrawerProps) {
  // Esc closes; lock body scroll while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return (
    <>
      {/* backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[var(--z-overlay)] bg-black/40 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        aria-hidden={!open}
        onClick={onClose}
      />
      {/* panel */}
      <aside
        className={cn(
          "fixed right-0 top-0 z-[var(--z-modal)] flex h-full w-full max-w-[480px] flex-col border-l border-[var(--rule-default)] bg-[var(--bg-elevated)] shadow-lg transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <header className="flex items-center justify-between border-b border-[var(--rule-default)] px-5 py-4">
          <h2 className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
            Impression detail
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="font-display text-[12px] text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading && (
            <div className="space-y-3">
              <Skel className="h-4 w-32" />
              <Skel className="h-8 w-full" />
              <Skel className="h-4 w-2/3" />
              <Skel className="mt-6 h-4 w-24" />
              <Skel className="h-12 w-full" />
            </div>
          )}

          {error && <p className="font-body text-[13px] text-[var(--status-negative)]">{error}</p>}

          {!loading && !error && detail && <DetailBody detail={detail} />}
        </div>
      </aside>
    </>
  )
}

function DetailBody({ detail }: { detail: ImpressionDetail }) {
  return (
    <div className="space-y-6">
      {/* creative preview */}
      {detail.creative && (
        <section>
          <SectionLabel>creative</SectionLabel>
          <div className="mt-2 rounded-md border border-[var(--rule-default)] bg-[var(--bg-inset)] p-4">
            <p className="font-display text-[14px] font-bold leading-[1.3] text-[var(--ink-primary)]">
              {detail.creative.headline}
            </p>
            {detail.creative.body && (
              <p className="mt-1 font-body text-[12px] leading-[1.5] text-[var(--ink-secondary)]">
                {detail.creative.body}
              </p>
            )}
            {detail.creative.ctaText && (
              <p className="mt-2 font-display text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--accent-color)]">
                {detail.creative.ctaText} →
              </p>
            )}
          </div>
        </section>
      )}

      {/* earnings */}
      <section className="rounded-md border border-[var(--rule-default)] bg-[var(--bg-inset)] px-4 py-3">
        <div className="flex items-baseline justify-between">
          <SectionLabel>earned</SectionLabel>
          <span className="font-data text-[24px] font-bold tabular-nums text-[var(--ink-primary)]">
            {formatUsdPrecise(detail.earnedAmount)}
          </span>
        </div>
        <p className="mt-1 font-body text-[11px] text-[var(--ink-tertiary)]">
          cpm {formatUsdPrecise(detail.cpmRate, 2)} · {detail.result}
        </p>
      </section>

      {/* meta grid */}
      <section>
        <SectionLabel>details</SectionLabel>
        <dl className="mt-2 divide-y divide-[var(--rule-subtle)] rounded-md border border-[var(--rule-default)]">
          <Row k="When" v={formatDateTimeShort(detail.createdAt)} />
          <Row k="Source" v={detail.source} />
          <Row k="Surface" v={detail.surface} />
          {detail.category && <Row k="Category" v={categoryLabel(detail.category)} />}
          <Row k="Duration" v={formatDurationMs(detail.durationMs)} />
          {detail.advertiserName && <Row k="Advertiser" v={detail.advertiserName} />}
          {detail.campaignName && <Row k="Campaign" v={detail.campaignName} />}
          {detail.click && <Row k="Discovered" v={formatDateTimeShort(detail.click.createdAt)} />}
        </dl>
      </section>

      {/* identifier */}
      <section>
        <SectionLabel>identifiers</SectionLabel>
        <dl className="mt-2 space-y-2 text-[11px]">
          <KvCopy k="impression" v={detail.id} />
          {detail.deliveryJti && <KvCopy k="delivery jti" v={detail.deliveryJti} />}
        </dl>
      </section>

      {/* report */}
      <section className="border-t border-[var(--rule-default)] pt-4">
        <a
          href={`mailto:abuse@devdrip.dev?subject=Report%20impression%20${detail.id}`}
          className="font-body text-[12px] text-[var(--ink-secondary)] underline-offset-2 hover:text-[var(--ink-primary)] hover:underline"
        >
          report this ad
        </a>
      </section>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-display text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
      {children}
    </p>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <dt className="font-body text-[11px] text-[var(--ink-tertiary)]">{k}</dt>
      <dd className="font-body text-[12px] text-[var(--ink-primary)]">{v}</dd>
    </div>
  )
}

function KvCopy({ k, v }: { k: string; v: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="font-display font-bold uppercase tracking-[0.12em] text-[var(--ink-tertiary)]">
        {k}
      </dt>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(v).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          })
        }}
        className="truncate rounded border border-[var(--rule-default)] bg-[var(--bg-inset)] px-2 py-1 text-left font-data text-[11px] text-[var(--ink-secondary)] transition-colors hover:border-[var(--rule-strong)] hover:text-[var(--ink-primary)]"
        title="click to copy"
      >
        {copied ? "copied" : v}
      </button>
    </div>
  )
}

function Skel({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-[var(--bg-inset)]", className)} />
}
