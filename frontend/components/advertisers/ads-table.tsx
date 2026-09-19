"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { SharpButton } from "@/components/v5/sharp-button"
import { cn } from "@/lib/utils"
import { adError, type AdvertiserAd } from "@/lib/advertiser-ads"

interface ToggleResult {
  ok: boolean
  error?: string
}

// sub-dollar amounts need four places to show anything at all
function money(usd: number): string {
  return `$${usd.toFixed(usd < 1 ? 4 : 2)}`
}

export function AdsTable({
  ads,
  setStatus,
}: {
  ads: AdvertiserAd[]
  setStatus: (id: string, status: "active" | "paused") => Promise<ToggleResult>
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)
  const [, startTransition] = useTransition()

  if (ads.length === 0) {
    return (
      <p className="m-0 border border-dashed border-[var(--rule-strong)] px-4 py-6 font-body text-[14px] text-[var(--ink-secondary)]">
        No ads yet. Write one above.
      </p>
    )
  }

  const toggle = (ad: AdvertiserAd) => {
    setRowError(null)
    setBusyId(ad.id)
    startTransition(async () => {
      const res = await setStatus(ad.id, ad.status === "active" ? "paused" : "active")
      setBusyId(null)
      if (!res.ok) setRowError({ id: ad.id, message: adError(res.error ?? "").message })
      router.refresh()
    })
  }

  return (
    // the table scrolls inside this box on narrow screens; the page never does
    <div
      tabIndex={0}
      role="region"
      aria-label="Your ads"
      className="relative overflow-x-auto border border-[var(--rule-default)] bg-[var(--bg-surface)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--accent-color)]"
    >
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[var(--rule-default)] font-data text-[11px] text-[var(--ink-tertiary)]">
            <th scope="col" className="px-4 py-2.5 font-normal">
              ad
            </th>
            <th scope="col" className="px-3 py-2.5 font-normal">
              status
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-normal">
              views
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-normal">
              clicks
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-normal">
              CTR
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-normal">
              est. spend
            </th>
            <th scope="col" className="px-4 py-2.5 font-normal">
              <span className="sr-only">action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ads.map((ad) => (
            <tr
              key={ad.id}
              className="border-b border-[var(--rule-subtle)] align-top last:border-b-0"
            >
              <td className="max-w-[360px] px-4 py-3">
                <div className="font-body text-[14px] font-medium text-[var(--ink-primary)]">
                  {ad.brand}
                </div>
                <div className="mt-0.5 break-words font-body text-[13px] leading-[1.5] text-[var(--ink-secondary)]">
                  {ad.line}
                </div>
                {rowError?.id === ad.id && (
                  <p
                    role="alert"
                    className="m-0 mt-1 font-body text-[12px] text-[var(--status-negative)]"
                  >
                    {rowError.message}
                  </p>
                )}
              </td>
              <td
                className={cn(
                  "whitespace-nowrap px-3 py-3 font-data text-[12px]",
                  ad.status === "active"
                    ? "text-[var(--status-positive)]"
                    : "text-[var(--ink-secondary)]"
                )}
              >
                {ad.status === "review" ? "in review" : ad.status}
              </td>
              <td className="px-3 py-3 text-right font-data text-[13px] tabular-nums">
                {ad.stats.views.toLocaleString("en-US")}
              </td>
              <td className="px-3 py-3 text-right font-data text-[13px] tabular-nums">
                {ad.stats.clicks.toLocaleString("en-US")}
              </td>
              <td className="px-3 py-3 text-right font-data text-[13px] tabular-nums">
                {(ad.stats.ctr * 100).toFixed(1)}%
              </td>
              <td className="px-3 py-3 text-right font-data text-[13px] tabular-nums">
                {money(ad.stats.spend)}
              </td>
              <td className="px-4 py-2.5 text-right">
                {ad.status !== "review" && (
                  <SharpButton
                    variant="secondary"
                    className="px-3 py-1.5 text-[12px]"
                    disabled={busyId === ad.id}
                    onClick={() => toggle(ad)}
                    aria-label={`${ad.status === "active" ? "Pause" : "Resume"} ${ad.brand}`}
                  >
                    {ad.status === "active" ? "Pause" : "Resume"}
                  </SharpButton>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
