"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { motion } from "motion/react"
import { terminalColors as tc, tokens } from "@/lib/design-tokens"

const TRANSCRIPT_LINES = [
  "This task is sponsored by Sentry.",
  "Quick tip: Use AI grouping to reduce alert noise by 40%.",
  "Learn more at sentry.io/devdrip",
]

// each line reveals at these elapsed-second thresholds
const LINE_THRESHOLDS = [0, 5, 10]

const BAR_COUNT = 7

export function AudioCompanionDemo() {
  const [elapsed, setElapsed] = useState(0)
  const [muted, setMuted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const muteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // stable heights computed once per mount
  const barHeights = useMemo(
    () => Array.from({ length: BAR_COUNT }, () => 20 + Math.random() * 20),
    []
  )

  // timer ticks 0→15
  useEffect(() => {
    if (muted) return
    if (elapsed >= 15) {
      const t = setTimeout(() => setElapsed(0), 2000)
      return () => clearTimeout(t)
    }
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(interval)
  }, [elapsed, muted])

  // auto-unmute after 3s
  useEffect(() => {
    if (!muted) return
    muteTimerRef.current = setTimeout(() => {
      setMuted(false)
      setElapsed(0)
    }, 3000)
    return () => {
      if (muteTimerRef.current) clearTimeout(muteTimerRef.current)
    }
  }, [muted])

  const handleMute = useCallback(() => {
    if (!muted) setMuted(true)
  }, [muted])

  // any keystroke mutes
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = () => {
      handleMute()
    }
    el.addEventListener("keydown", handler)
    return () => el.removeEventListener("keydown", handler)
  }, [handleMute])

  const visibleLines = TRANSCRIPT_LINES.filter((_, i) => elapsed >= LINE_THRESHOLDS[i])

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="max-w-[480px] mx-auto rounded-lg overflow-hidden outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
      style={{ background: tc.bg, border: `1px solid ${tc.border}` }}
    >
      {/* header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: `1px solid ${tc.border}` }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: tc.text }}>&#x1F50A;</span>
          <span className="font-display text-[12px] font-bold" style={{ color: tc.text }}>
            Dev Drip Audio
          </span>
        </div>
        <span className="font-data text-data-xs font-bold" style={{ color: "var(--accent-color)" }}>
          +$0.02
        </span>
      </div>

      {/* waveform + status */}
      <div className="p-4">
        <div className="flex items-center gap-4 mb-4">
          {/* waveform bars */}
          <div className="flex items-end gap-[3px] h-[40px]">
            {Array.from({ length: BAR_COUNT }).map((_, i) => (
              <motion.div
                key={i}
                className="w-[3px] rounded-full"
                style={{ background: muted ? tc.textFaint : tc.textSecondary }}
                animate={
                  muted
                    ? { height: 8 }
                    : {
                        height: [8, barHeights[i], 8],
                      }
                }
                transition={
                  muted
                    ? { duration: 0.2 }
                    : {
                        duration: 1.0 + i * 0.1,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.15,
                      }
                }
              />
            ))}
          </div>

          {/* status */}
          <div className="flex-1">
            <div
              className="font-body text-[11px] font-medium mb-1"
              style={{ color: muted ? tc.textTertiary : tc.text }}
            >
              {muted ? "Muted" : "Playing..."}
            </div>
            <div className="font-data text-[10px]" style={{ color: tc.textTertiary }}>
              {muted ? "Auto-resumes in 3s" : `${elapsed}s / 15s`}
            </div>
          </div>

          {/* progress arc (simple bar) */}
          <div className="w-[60px]">
            <div className="h-1 rounded-pill overflow-hidden" style={{ background: tc.textFaint }}>
              <div
                className="h-full rounded-pill transition-all duration-1000 ease-linear"
                style={{
                  width: muted ? "0%" : `${(elapsed / 15) * 100}%`,
                  background: "var(--accent-color)",
                }}
              />
            </div>
          </div>
        </div>

        {/* transcript */}
        <div
          className="rounded p-3 min-h-[72px]"
          style={{ background: tc.bgInset, border: `1px solid ${tc.border}` }}
        >
          <div
            className="font-body text-[9px] font-semibold uppercase tracking-[0.08em] mb-2"
            style={{ color: tc.textTertiary }}
          >
            Transcript
          </div>
          <div className="space-y-1">
            {visibleLines.map((line, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: tokens.timing.fast / 1000 }}
                className="font-body text-[11px] leading-relaxed"
                style={{ color: tc.textSecondary }}
              >
                {line}
              </motion.p>
            ))}
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between mt-3">
          <span className="font-data text-[10px]" style={{ color: tc.textTertiary }}>
            Any keystroke mutes instantly
          </span>
          <span className="font-data text-[10px]" style={{ color: tc.textTertiary }}>
            Double opt-in required
          </span>
        </div>
      </div>
    </div>
  )
}
