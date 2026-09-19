"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { formatUsdc } from "@devdrip/shared/format"

interface WalletSummaryProps {
  walletAddress: string | null
  available: number
  lifetime: number
  pending: number
}

const WORLD_APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID ?? ""

export function WalletSummary({ walletAddress, available, lifetime, pending }: WalletSummaryProps) {
  const [qrSvg, setQrSvg] = useState<string>("")
  const deeplink = `https://world.org/mini-app?app_id=${WORLD_APP_ID}`

  useEffect(() => {
    void QRCode.toString(deeplink, { type: "svg", width: 160, margin: 1 }).then(setQrSvg)
  }, [deeplink])

  const truncated = walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : null

  return (
    <section className="grid gap-6 rounded-lg border border-[var(--rule-default)] p-6 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <span className="text-sm text-[var(--ink-secondary)]">Available</span>
        <span className="text-4xl font-semibold tabular-nums">{formatUsdc(available)}</span>
        <div className="grid grid-cols-2 gap-3 text-xs text-[var(--ink-secondary)]">
          <div>
            Lifetime:{" "}
            <span className="text-[var(--ink-primary)] tabular-nums">{formatUsdc(lifetime)}</span>
          </div>
          <div>
            Pending:{" "}
            <span className="text-[var(--ink-primary)] tabular-nums">{formatUsdc(pending)}</span>
          </div>
        </div>
        {truncated && (
          <div className="text-xs text-[var(--ink-secondary)]">
            Wallet: <code className="text-[var(--ink-primary)]">{truncated}</code>
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-[var(--ink-secondary)]">Claim in DevDrip Mini App</p>
        {qrSvg && (
          <div
            className="rounded-md border border-[var(--rule-default)] bg-white p-2"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        )}
        <a
          href={deeplink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--accent)] underline"
        >
          {deeplink}
        </a>
      </div>
    </section>
  )
}
