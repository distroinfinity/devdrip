"use client"

import { useEffect, useState } from "react"
import { PUBLIC_API_URL } from "@/lib/env"
import type { NowPlayingDto } from "@distrotv/shared"

interface Props {
  deviceId: string
  token: string
  onNowChange?: (now: NowPlayingDto | null) => void
}

function buildProgressBar(
  startedAt: string,
  endsAt: string
): { bar: string; pct: number; secsLeft: number } {
  const start = new Date(startedAt).getTime()
  const end = new Date(endsAt).getTime()
  const now = Date.now()
  const total = end - start
  const elapsed = now - start
  const pct = Math.max(0, Math.min(100, total > 0 ? (elapsed / total) * 100 : 0))
  const secsLeft = Math.max(0, Math.round((end - now) / 1000))
  const filled = Math.round(pct / 5)
  const empty = 20 - filled
  const bar = "▓".repeat(filled) + "░".repeat(empty)
  return { bar, pct: Math.round(pct), secsLeft }
}

function renderActiveSlot(
  now: NowPlayingDto & { active: NonNullable<NowPlayingDto["active"]> }
): React.ReactNode {
  const active = now.active
  const p = active.payload as Record<string, unknown>
  const { bar, pct, secsLeft } = buildProgressBar(active.startedAt, active.endsAt)
  const startTime = new Date(active.startedAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  let slotContent: React.ReactNode

  if (active.kind === "ticker") {
    const sym = String(p?.symbol ?? "")
    const price =
      typeof p?.price === "number"
        ? `$${p.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : "—"
    const changePct = typeof p?.changePct === "number" ? p.changePct : null
    const isAlert = !!p?.alert
    const pctStr = changePct !== null ? `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%` : ""

    slotContent = (
      <>
        <span style={{ color: "#5C5C66" }}>│</span>
        {"  "}
        {isAlert ? (
          <span style={{ color: "#F87171", fontWeight: 700 }}>!ALERT</span>
        ) : (
          <span style={{ color: "#A5B4FC" }}>TICKER</span>
        )}
        {"   "}
        <span style={{ color: "#EDEDF0" }}>{sym}</span>
        {"  "}
        <span style={{ color: changePct !== null && changePct >= 0 ? "#34D399" : "#F87171" }}>
          {pctStr}
        </span>
        {"  "}
        <span style={{ color: "#5C5C66" }}>│</span>
        {"\n"}
        <span style={{ color: "#5C5C66" }}>│</span>
        {"  "}
        <span style={{ color: "#5C5C66" }}>px</span>
        {"       "}
        <span style={{ color: "#EDEDF0" }}>{price}</span>
        {"  "}
        <span style={{ color: "#5C5C66" }}>{p?.name ? String(p.name).slice(0, 24) : ""}</span>
        {"  "}
        <span style={{ color: "#5C5C66" }}>│</span>
      </>
    )
  } else if (active.kind === "alert") {
    const sym = String(p?.symbol ?? (p?.alert as Record<string, unknown>)?.symbol ?? "")
    const changePct =
      typeof p?.changePct === "number"
        ? p.changePct
        : typeof (p?.alert as Record<string, unknown>)?.changePct === "number"
          ? ((p.alert as Record<string, unknown>).changePct as number)
          : null
    const threshold =
      typeof p?.thresholdPct === "number"
        ? p.thresholdPct
        : typeof (p?.alert as Record<string, unknown>)?.thresholdPct === "number"
          ? ((p.alert as Record<string, unknown>).thresholdPct as number)
          : null
    const pctStr = changePct !== null ? `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%` : ""

    slotContent = (
      <>
        <span style={{ color: "#5C5C66" }}>│</span>
        {"  "}
        <span style={{ color: "#F87171", fontWeight: 700 }}>!ALERT</span>
        {"   "}
        <span style={{ color: "#EDEDF0" }}>{sym}</span>
        {"  "}
        <span style={{ color: "#5C5C66" }}>breach threshold</span>
        {"  "}
        <span style={{ color: "#F87171" }}>{pctStr}</span>
        {"  "}
        <span style={{ color: "#5C5C66" }}>│</span>
        {"\n"}
        {threshold !== null && (
          <>
            <span style={{ color: "#5C5C66" }}>│</span>
            {"  "}
            <span style={{ color: "#5C5C66" }}>threshold</span>
            {"  "}
            <span style={{ color: "#EDEDF0" }}>±{threshold}%</span>
            {"  "}
            <span style={{ color: "#5C5C66" }}>global</span>
            {"  "}
            <span style={{ color: "#5C5C66" }}>│</span>
          </>
        )}
      </>
    )
  } else {
    // news
    const headline = String(p?.headline ?? p?.title ?? "news")
    const source = String(p?.source ?? "").toUpperCase()
    const score = typeof p?.score === "number" ? `${p.score} pts` : ""
    const truncated = headline.length > 52 ? headline.slice(0, 52) + "…" : headline

    slotContent = (
      <>
        <span style={{ color: "#5C5C66" }}>│</span>
        {"  "}
        <span style={{ color: "#A5B4FC" }}>{source || "NEWS"}</span>
        {"   "}
        <span style={{ color: "#EDEDF0" }}>{truncated}</span>
        {"  "}
        <span style={{ color: "#5C5C66" }}>│</span>
        {"\n"}
        {score && (
          <>
            <span style={{ color: "#5C5C66" }}>│</span>
            {"  "}
            <span style={{ color: "#5C5C66" }}>{score}</span>
            {"  "}
            <span style={{ color: "#5C5C66" }}>│</span>
          </>
        )}
      </>
    )
  }

  return (
    <pre
      className="m-0 whitespace-pre-wrap"
      style={{ fontFamily: "inherit", fontSize: "inherit", lineHeight: "inherit" }}
    >
      <span style={{ color: "#34D399" }}>$</span> <span style={{ color: "#A5B4FC" }}>distro</span>
      {" overview "}
      <span style={{ color: "#5C5C66" }}>--live --tail</span>
      {"\n\n"}
      <span style={{ color: "#2A2A2E" }}>
        {"┌─ SLOT " + startTime + " " + "─".repeat(Math.max(0, 45 - startTime.length)) + "┐"}
      </span>
      {"\n"}
      {slotContent}
      {"\n"}
      <span style={{ color: "#2A2A2E" }}>│</span>
      {"                                                         "}
      <span style={{ color: "#2A2A2E" }}>│</span>
      {"\n"}
      <span style={{ color: "#2A2A2E" }}>│</span>
      {"  "}
      <span style={{ color: "#5C5C66", letterSpacing: "1px" }}>{bar}</span>
      {"  "}
      <span style={{ color: "#5C5C66" }}>{pct}%</span>
      {"  "}
      <span style={{ color: "#5C5C66" }}>— ends in {secsLeft}s</span>
      {"      "}
      <span style={{ color: "#2A2A2E" }}>│</span>
      {"\n"}
      <span style={{ color: "#2A2A2E" }}>{"└" + "─".repeat(57) + "┘"}</span>
      {"\n"}
      {now.next && (
        <>
          {"\n"}
          <span style={{ color: "#5C5C66" }}>▸ next</span>
          {"  "}
          <span style={{ color: "#A5B4FC" }}>{now.next.kind}</span>
          {"     "}
          <span style={{ color: "#EDEDF0" }}>{now.next.preview}</span>
        </>
      )}
      {"\n\n"}
      <span style={{ color: "#34D399" }}>$</span>{" "}
      <span
        className="blink"
        style={{
          display: "inline-block",
          width: "7px",
          height: "13px",
          background: "#A5B4FC",
          verticalAlign: "-2px",
          marginLeft: "1px",
          animation: "blink 1.1s step-end infinite",
        }}
      />
    </pre>
  )
}

function renderIdle(): React.ReactNode {
  return (
    <pre
      className="m-0 whitespace-pre-wrap"
      style={{ fontFamily: "inherit", fontSize: "inherit", lineHeight: "inherit" }}
    >
      <span style={{ color: "#34D399" }}>$</span> <span style={{ color: "#A5B4FC" }}>distro</span>
      {" overview "}
      <span style={{ color: "#5C5C66" }}>--idle</span>
      {"\n\n"}
      <span style={{ color: "#5C5C66" }}>no slot rendering · daemon idle or not connected</span>
      {"\n\n"}
      <span style={{ color: "#34D399" }}>$</span>{" "}
      <span
        className="blink"
        style={{
          display: "inline-block",
          width: "7px",
          height: "13px",
          background: "#A5B4FC",
          verticalAlign: "-2px",
          marginLeft: "1px",
          animation: "blink 1.1s step-end infinite",
        }}
      />
    </pre>
  )
}

export function TerminalMirror({ deviceId, token, onNowChange }: Props) {
  const [now, setNow] = useState<NowPlayingDto | null>(null)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch(`${PUBLIC_API_URL}/me/devices/${deviceId}/now`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        })
        if (!res.ok) return
        const data = (await res.json()) as NowPlayingDto
        if (!cancelled) {
          setNow(data)
          onNowChange?.(data)
        }
      } catch {
        // network error — keep last known state
      }
    }

    poll()
    const id = setInterval(poll, 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [deviceId, token, onNowChange])

  return (
    <div className="px-8 py-5 border-b border-[var(--rule-default)]">
      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
      <div
        style={{
          background: "#0E0E11",
          border: "1px solid #2A2A2E",
          borderRadius: 0,
          color: "#EDEDF0",
          fontFamily: "var(--font-data), 'JetBrains Mono', monospace",
          overflow: "hidden",
        }}
      >
        {/* title bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "9px 14px",
            borderBottom: "1px solid #2A2A2E",
            background: "rgba(255,255,255,0.012)",
          }}
        >
          <div style={{ display: "flex", gap: "6px" }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: "9px",
                  height: "9px",
                  border: "1px solid #2A2A2E",
                  borderRadius: 0,
                  display: "block",
                }}
              />
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontFamily: "var(--font-display, 'Space Mono', monospace)",
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#8A8A94",
            }}
          >
            <span
              style={{
                width: "5px",
                height: "5px",
                background: "#34D399",
                boxShadow: "0 0 6px rgba(52,211,153,0.6)",
                animation: "pulse 2.4s ease-in-out infinite",
                display: "inline-block",
              }}
            />
            now playing · slot mirror
          </div>
          <div
            style={{
              marginLeft: "auto",
              fontFamily: "var(--font-data, monospace)",
              fontSize: "9px",
              color: "#5C5C66",
              letterSpacing: "0.06em",
            }}
          >
            distro overview --live --tail
          </div>
        </div>

        {/* body */}
        <div
          style={{ padding: "18px 22px", fontSize: "12px", lineHeight: "1.7", color: "#EDEDF0" }}
        >
          {now?.active
            ? renderActiveSlot(
                now as NowPlayingDto & { active: NonNullable<NowPlayingDto["active"]> }
              )
            : renderIdle()}
        </div>
      </div>
    </div>
  )
}
