"use client"

import type { NowPlayingDto } from "@distrotv/shared"

interface Props {
  now: NowPlayingDto | null
  deviceName?: string
}

function formatCountdown(endsAt: string): string {
  const sec = Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 1000))
  return `ends in ${sec}s`
}

function renderSlotLabel(now: NowPlayingDto): React.ReactNode {
  const active = now.active
  if (!active) return <span className="text-[var(--ink-tertiary)]">no active slot</span>

  const p = active.payload as Record<string, unknown>

  if (active.kind === "ticker") {
    const sym = String(p?.symbol ?? "")
    const changePct = typeof p?.changePct === "number" ? p.changePct : null
    const isPos = changePct !== null && changePct >= 0
    return (
      <>
        <span className="font-semibold">{sym}</span>
        <span className="text-[var(--ink-secondary)]"> price update</span>
        {changePct !== null && (
          <span
            className={[
              "ml-3 font-[var(--font-data)] tabular-nums",
              isPos ? "text-[#2F8F4E]" : "text-[var(--status-negative)]",
            ].join(" ")}
          >
            {isPos ? "+" : ""}
            {changePct.toFixed(2)}%
          </span>
        )}
      </>
    )
  }

  if (active.kind === "alert") {
    const alertInner = p?.alert as Record<string, unknown> | undefined
    const sym = String(p?.symbol ?? alertInner?.symbol ?? "")
    const changePct =
      typeof p?.changePct === "number"
        ? p.changePct
        : typeof (p?.alert as Record<string, unknown>)?.changePct === "number"
          ? ((p.alert as Record<string, unknown>).changePct as number)
          : null
    const isPos = changePct !== null && changePct >= 0
    return (
      <>
        <span className="font-semibold">{sym}</span>
        <span className="text-[var(--ink-secondary)]"> alert · breach</span>
        {changePct !== null && (
          <span
            className={[
              "ml-3 font-[var(--font-data)] tabular-nums",
              isPos ? "text-[#2F8F4E]" : "text-[var(--status-negative)]",
            ].join(" ")}
          >
            {isPos ? "+" : ""}
            {changePct.toFixed(2)}%
          </span>
        )}
      </>
    )
  }

  // news
  const headline = String(p?.headline ?? p?.title ?? "news slot")
  const source = String(p?.source ?? "")
  return (
    <>
      {source && (
        <span className="font-[var(--font-data)] text-[10px] font-semibold tracking-wide uppercase text-[var(--ink-secondary)] mr-2">
          {source}
        </span>
      )}
      <span className="font-medium">
        {headline.slice(0, 80)}
        {headline.length > 80 ? "…" : ""}
      </span>
    </>
  )
}

export function LiveBar({ now, deviceName }: Props) {
  const active = now?.active

  return (
    <div
      className="flex items-center gap-3.5 px-8 py-[11px] border-b border-[var(--rule-default)]"
      style={{ background: "var(--bg-secondary)" }}
    >
      {/* LIVE pill */}
      <span className="inline-flex items-center gap-1.5 px-2 py-[3px] border border-[var(--rule-default)] bg-[var(--bg-surface)] font-[var(--font-display)] text-[9px] font-bold tracking-[0.1em] text-[var(--ink-secondary)] uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-[#2F8F4E] shadow-[0_0_6px_rgba(47,143,78,0.6)] animate-pulse" />
        LIVE
      </span>

      {/* slot description */}
      <span className="font-[var(--font-body)] text-[12.5px] text-[var(--ink-primary)] flex items-center gap-1 flex-1 min-w-0">
        {active && now ? (
          renderSlotLabel(now)
        ) : (
          <span className="text-[var(--ink-tertiary)]">idle · no slot rendering</span>
        )}
      </span>

      {/* when / device */}
      {active && (
        <span className="font-[var(--font-data)] text-[10px] text-[var(--ink-tertiary)] shrink-0">
          {new Date(active.startedAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })}
          {deviceName ? ` · ${deviceName}` : ""}
          {" · "}
          {formatCountdown(active.endsAt)}
        </span>
      )}
    </div>
  )
}
