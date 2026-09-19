"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts"

interface Candle {
  date: string
  close: number
}

interface CandlesData {
  symbol: string
  assetClass: "equity" | "crypto"
  range: string
  candles: Candle[]
}

const RANGES = ["1d", "1w", "1m", "3m", "1y"] as const

export function ChartClient({ initial }: { initial: CandlesData }) {
  const [data, setData] = useState<CandlesData>(initial)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const params = useSearchParams()

  function setRange(r: (typeof RANGES)[number]) {
    if (r === data.range) return
    start(async () => {
      setError(null)
      const next = new URLSearchParams(params.toString())
      next.set("range", r)
      router.replace(`?${next.toString()}`)
      try {
        const httpResp = await fetch(`/api/chart/${encodeURIComponent(data.symbol)}?range=${r}`)
        if (!httpResp.ok) {
          setError(`couldn't load ${r} (${httpResp.status})`)
          return
        }
        const resp = await httpResp.json()
        if (resp?.candles) setData(resp)
        else setError("no candles returned")
      } catch (e) {
        setError(e instanceof Error ? e.message : "network error")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            disabled={pending}
            className={
              r === data.range
                ? "px-3 py-1 bg-[var(--accent-color)] text-white rounded text-sm"
                : "px-3 py-1 border border-[var(--rule-default)] rounded text-sm"
            }
          >
            {r}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="h-80 rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.candles}>
            <XAxis dataKey="date" tick={false} axisLine={false} />
            <YAxis domain={["auto", "auto"]} width={60} />
            <Tooltip />
            <Line type="monotone" dataKey="close" stroke="#000" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
