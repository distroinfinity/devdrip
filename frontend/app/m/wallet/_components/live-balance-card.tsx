"use client"

import { useEffect, useRef, useState } from "react"
import { BalanceCard } from "./balance-card"

interface LiveBalanceCardProps {
  initialAvailable: number
  initialLifetime: number
  initialPending: number
}

interface BalanceShape {
  availableUsdc: number
  lifetimeEarnedUsdc: number
  pendingPayoutsUsdc: number
}

const POLL_MS = 2_000

// Wraps BalanceCard with a 2s poll on /api/me/balance so the displayed amount
// ticks up in real time as the CLI's terminal-tv toasts fire (which POST to
// /me/balance/mock-earn). Uses initial server-rendered values to avoid a
// hydration flash; switches to client values after the first successful poll.
export function LiveBalanceCard({
  initialAvailable,
  initialLifetime,
  initialPending,
}: LiveBalanceCardProps) {
  const [b, setB] = useState<BalanceShape>({
    availableUsdc: initialAvailable,
    lifetimeEarnedUsdc: initialLifetime,
    pendingPayoutsUsdc: initialPending,
  })
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    let timer: ReturnType<typeof setTimeout> | null = null
    async function tick() {
      try {
        const r = await fetch("/api/me/balance", {
          credentials: "include",
          cache: "no-store",
        })
        if (r.ok) {
          const next = (await r.json()) as BalanceShape
          if (!cancelled.current) setB(next)
        }
      } catch {
        // network blip — try again next tick
      }
      if (!cancelled.current) timer = setTimeout(tick, POLL_MS)
    }
    timer = setTimeout(tick, POLL_MS)
    return () => {
      cancelled.current = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  return (
    <BalanceCard
      available={b.availableUsdc}
      lifetime={b.lifetimeEarnedUsdc}
      pending={b.pendingPayoutsUsdc}
    />
  )
}
