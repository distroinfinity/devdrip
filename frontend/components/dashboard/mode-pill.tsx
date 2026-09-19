"use client"

import { useState, useTransition } from "react"
import { ChannelMode } from "@distrotv/shared"
import { SegmentedPill } from "@/components/v5/segmented-pill"
import { updateChannelMode } from "@/app/dashboard/actions"

const OPTIONS = [
  { value: ChannelMode.NewsOnly, label: "NEWS" },
  { value: ChannelMode.NewsHeavy, label: "3:1" },
  { value: ChannelMode.Balanced, label: "1:1" },
  { value: ChannelMode.TickerHeavy, label: "1:3" },
  { value: ChannelMode.TickerOnly, label: "TICKER" },
]

export function ModePill({ initial }: { initial: ChannelMode }) {
  const [mode, setMode] = useState<ChannelMode>(initial)
  const [, startTransition] = useTransition()

  function pick(next: ChannelMode) {
    if (next === mode) return
    const prev = mode
    setMode(next)
    startTransition(async () => {
      const result = await updateChannelMode(next)
      if (!result.ok) setMode(prev)
    })
  }

  return <SegmentedPill options={OPTIONS} value={mode} onChange={pick} />
}
