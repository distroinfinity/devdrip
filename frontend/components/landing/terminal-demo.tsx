"use client"

import { type ChangeEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

type Phase = "prompt" | "working" | "typing"

const ADS = [
  {
    advertiser: "Railway",
    copy: "Ship your app in minutes. Infrastructure that gets out of the way.",
    url: "https://api.distrotv.xyz/c/3f0c2f0e7f1a",
  },
  {
    advertiser: "Neon",
    copy: "Serverless Postgres with branching. A database for every pull request.",
    url: "https://api.distrotv.xyz/c/9b41d7c2a6e0",
  },
]

const PER_VIEW = 0.007
const TODAY_START = 0.07

const SCRIPTS = [
  {
    prompt: "refactor the auth module and run the tests",
    lines: [
      "Read   src/auth/session.ts",
      "Read   src/auth/middleware.ts",
      "Edit   src/auth/session.ts  +38 −21",
      "Edit   src/auth/middleware.ts  +12 −9",
      "Bash · pnpm test auth",
      "  ✓ session rotates on login (41 ms)",
      "  ✓ expired token is rejected (12 ms)",
      "Bash · pnpm typecheck",
    ],
    reply: "looks good, now add rate limiting",
  },
  {
    prompt: "looks good, now add rate limiting",
    lines: [
      "Read   src/routes/login.ts",
      "Grep   rateLimit  (0 matches)",
      "Edit   src/lib/rate-limit.ts  +54 −0",
      "Edit   src/routes/login.ts  +9 −2",
      "Bash · pnpm test login",
      "  ✓ sixth attempt returns 429 (23 ms)",
      "  ✓ window resets after 60s (8 ms)",
      "Bash · pnpm lint",
    ],
    reply: "ship it and open a pull request",
  },
]

const LINE_AT = [600, 1200, 1900, 2600, 3300, 4600, 5400, 6400]
const SLOT_AT = 600
const PAID_AFTER = 1000
const SECOND_AD_AT = 4600
const TYPE_AT = 8600
const TYPE_EVERY = 90
const RESUME_AFTER = 2000
const TICK = 100
// the server-rendered frame is mid-run (slot up, five lines in); the loop picks up from there
const FIRST_FRAME_LINES = 5
const FIRST_FRAME_AT = 3400

const STATES = ["agent working", "slot showing", "you're typing"]

export function TerminalDemo() {
  const [phase, setPhase] = useState<Phase>("working")
  const [prompt, setPrompt] = useState(SCRIPTS[0].prompt)
  const [lineCount, setLineCount] = useState(FIRST_FRAME_LINES)
  const [scriptIdx, setScriptIdx] = useState(0)
  const [adIdx, setAdIdx] = useState(0)
  const [slotVisible, setSlotVisible] = useState(true)
  const [today, setToday] = useState(TODAY_START + PER_VIEW)
  const [typed, setTyped] = useState("")
  const [clearedMs, setClearedMs] = useState<number | null>(null)
  const [announce, setAnnounce] = useState("")

  const rootRef = useRef<HTMLDivElement>(null)
  const elapsed = useRef(0)
  const fired = useRef(new Set<string>())
  const running = useRef(false)
  const reduced = useRef(false)
  const userTyping = useRef(false)
  const byUser = useRef(false)
  const dismissStart = useRef(0)
  const todayTarget = useRef(TODAY_START + PER_VIEW)
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const script = useRef(0)

  const countUp = useCallback((to: number) => {
    const from = todayTarget.current
    todayTarget.current = to
    if (reduced.current) {
      setToday(to)
      return
    }
    const t0 = performance.now()
    const frame = (now: number) => {
      const k = Math.min(1, (now - t0) / 500)
      setToday(from + (to - from) * k)
      if (k < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }, [])

  const startLoop = useCallback((nextPrompt?: string) => {
    elapsed.current = 0
    fired.current = new Set()
    userTyping.current = false
    if (nextPrompt !== undefined) {
      script.current = (script.current + 1) % SCRIPTS.length
      setScriptIdx(script.current)
      setPrompt(nextPrompt)
    }
    setTyped("")
    setLineCount(0)
    setAdIdx(0)
    setSlotVisible(false)
    setPhase("prompt")
  }, [])

  // the slot is removed in one commit, no exit animation — same as the product
  const clearSlot = useCallback((startedAt: number, fromUser: boolean) => {
    dismissStart.current = startedAt
    byUser.current = fromUser
    setSlotVisible(false)
    setPhase("typing")
  }, [])

  // measure keystroke → first frame painted without the slot
  useLayoutEffect(() => {
    if (slotVisible || dismissStart.current === 0) return
    const startedAt = dismissStart.current
    dismissStart.current = 0
    requestAnimationFrame(() => {
      setTimeout(() => {
        const ms = Math.max(1, Math.round(performance.now() - startedAt))
        setClearedMs(ms)
        if (byUser.current) setAnnounce(`slot cleared in ${ms} milliseconds`)
      }, 0)
    })
  }, [slotVisible])

  const scheduleResume = useCallback(
    (text: string) => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current)
      resumeTimer.current = setTimeout(() => {
        const next = text.trim().slice(0, 64) || SCRIPTS[(script.current + 1) % 2].prompt
        if (reduced.current) {
          // static frame: bring the slot straight back
          userTyping.current = false
          setTyped("")
          setPrompt(next)
          setSlotVisible(true)
          setPhase("working")
          return
        }
        startLoop(next)
      }, RESUME_AFTER)
    },
    [startLoop]
  )

  const onType = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setTyped(value)
      userTyping.current = true
      if (slotVisible) {
        const stamp = e.nativeEvent.timeStamp
        clearSlot(stamp > 0 ? stamp : performance.now(), true)
      } else {
        setPhase("typing")
      }
      scheduleResume(value)
    },
    [slotVisible, clearSlot, scheduleResume]
  )

  // one clock for the whole loop; it only advances while the demo is on screen
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const stopResume = () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current)
    }
    // reduced motion: no loop, the static frame stays; typing still clears it
    if (reduced.current) return stopResume

    let inView = false
    const sync = () => {
      running.current = inView && document.visibilityState === "visible"
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting
        sync()
      },
      { threshold: 0.35 }
    )
    io.observe(root)
    document.addEventListener("visibilitychange", sync)

    const once = (key: string, at: number, run: () => void) => {
      if (elapsed.current >= at && !fired.current.has(key)) {
        fired.current.add(key)
        run()
      }
    }

    elapsed.current = FIRST_FRAME_AT
    fired.current = new Set(["slot", "paid0"])
    for (let i = 0; i < FIRST_FRAME_LINES; i++) fired.current.add(`line${i}`)
    const iv = setInterval(() => {
      if (!running.current || userTyping.current) return
      elapsed.current += TICK
      const s = SCRIPTS[script.current]

      once("slot", SLOT_AT, () => {
        setSlotVisible(true)
        setPhase("working")
      })
      LINE_AT.forEach((at, i) => once(`line${i}`, at, () => setLineCount(i + 1)))
      once("paid0", SLOT_AT + PAID_AFTER, () => countUp(todayTarget.current + PER_VIEW))
      once("ad1", SECOND_AD_AT, () => setAdIdx(1))
      once("paid1", SECOND_AD_AT + PAID_AFTER, () => countUp(todayTarget.current + PER_VIEW))

      for (let i = 0; i < s.reply.length; i++) {
        once(`key${i}`, TYPE_AT + i * TYPE_EVERY, () => {
          if (i === 0) clearSlot(performance.now(), false)
          setTyped(s.reply.slice(0, i + 1))
        })
      }
      once("resume", TYPE_AT + s.reply.length * TYPE_EVERY + RESUME_AFTER, () => startLoop(s.reply))
    }, TICK)

    return () => {
      clearInterval(iv)
      io.disconnect()
      document.removeEventListener("visibilitychange", sync)
      stopResume()
    }
  }, [startLoop, clearSlot, countUp])

  const ad = ADS[adIdx]
  const lines = SCRIPTS[scriptIdx].lines.slice(0, lineCount)
  const active = phase === "working" ? [0, 1] : phase === "typing" ? [2] : []

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="Demo: a sponsored slot shows while the agent works and clears when you type"
    >
      <div className="border border-[var(--rule-strong)] bg-[#0A0A0C] font-data text-[12px] leading-[1.5] text-[#EDEDF0] shadow-[0_12px_32px_rgba(14,14,17,0.12)]">
        {/* frame head */}
        <div className="flex items-center gap-1.5 border-b border-[#1E1E22] px-3 py-2 text-[10px] text-[#5C5C66]">
          <span className="h-2 w-2 rounded-full border border-[#3A3A40]" />
          <span className="h-2 w-2 rounded-full border border-[#3A3A40]" />
          <span className="h-2 w-2 rounded-full border border-[#3A3A40]" />
          <span className="ml-2 text-[#8A8A94]">surface 01 — terminal</span>
          <span className="ml-auto flex items-center gap-1.5 text-[#8A8A94]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#27AD75]" />
            live
          </span>
        </div>

        {/* agent log */}
        <div
          aria-hidden="true"
          className="flex h-[132px] flex-col justify-end overflow-hidden px-4 pb-2 pt-3 sm:h-[188px]"
        >
          <div className="shrink-0 truncate text-[#EDEDF0]">
            <span className="mr-2 text-[#5C5C66]">&gt;</span>
            {prompt}
          </div>
          {lines.map((line) => (
            <div
              key={line}
              className={cn(
                "shrink-0 truncate",
                line.startsWith("  ") ? "text-[#5C5C66]" : "text-[#8A8A94]"
              )}
            >
              <span className="whitespace-pre">{line}</span>
            </div>
          ))}
          {phase === "working" && (
            <div className="shrink-0 text-[#5C5C66]">
              <span className="mr-2 inline-block animate-spin-slow text-[var(--accent-color)]">
                ⠋
              </span>
              working…
            </div>
          )}
        </div>

        {/* input line */}
        <label className="flex items-center gap-2 border-t border-[#1E1E22] px-4 py-2.5 focus-within:bg-[#111114] focus-within:shadow-[inset_2px_0_0_var(--accent-color)]">
          <span className="sr-only">Type to clear the slot</span>
          <span aria-hidden="true" className="text-[#5C5C66]">
            &gt;
          </span>
          <input
            type="text"
            value={typed}
            onChange={onType}
            placeholder="type anything…"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={80}
            className="min-w-0 flex-1 bg-transparent font-data text-[12px] text-[#EDEDF0] caret-[var(--accent-color)] outline-none placeholder:text-[#5C5C66]"
          />
        </label>

        {/* status line: height is reserved so the frame never jumps */}
        <div className="h-[92px] border-t border-[#1E1E22] px-4 py-2.5 text-[11px]">
          {slotVisible ? (
            <div className="border-l-2 border-[#6366F1] pl-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 bg-[#6366F1] px-1 text-[9px] font-bold leading-[1.5] text-[#0A0A0C]">
                    AD
                  </span>
                  <span className="truncate font-bold">{ad.advertiser}</span>
                </span>
                <span className="shrink-0 text-[#27AD75]">+${PER_VIEW.toFixed(4)}</span>
              </div>
              <div className="line-clamp-2 h-[33px] leading-[1.5]">{ad.copy}</div>
              <div className="flex items-baseline justify-between gap-3 text-[10px]">
                <span className="flex min-w-0 items-baseline">
                  <span className="truncate text-[#818CF8]">↗ {ad.url}</span>
                  <span className="ml-2 hidden shrink-0 text-[#5C5C66] sm:inline">⌘ click</span>
                </span>
                <span className="shrink-0 text-[#5C5C66]">est. today ${today.toFixed(4)}</span>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center text-[#5C5C66]">
              {clearedMs !== null && phase === "typing" ? (
                <span>
                  cleared in <span className="text-[#EDEDF0]">{clearedMs} ms</span>
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <span role="status" className="sr-only">
        {announce}
      </span>

      {/* the three states, in order */}
      <ol className="m-0 mt-3 flex list-none flex-wrap items-center gap-x-2 gap-y-1 p-0 font-data text-[11px]">
        {STATES.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && (
              <span aria-hidden="true" className="text-[var(--ink-tertiary)]">
                →
              </span>
            )}
            <span
              aria-current={active.includes(i) ? "step" : undefined}
              className={cn(
                "border px-1.5 py-0.5",
                active.includes(i)
                  ? "border-[var(--accent-color)] text-[var(--ink-primary)]"
                  : "border-transparent text-[var(--ink-tertiary)]"
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
