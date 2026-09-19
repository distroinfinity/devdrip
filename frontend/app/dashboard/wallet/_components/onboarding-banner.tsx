"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"

const WORLD_APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID ?? ""

export function OnboardingBanner() {
  const [qrSvg, setQrSvg] = useState<string>("")
  const deeplink = `https://world.org/mini-app?app_id=${WORLD_APP_ID}`

  useEffect(() => {
    void QRCode.toString(deeplink, { type: "svg", width: 128, margin: 1 }).then(setQrSvg)
  }, [deeplink])

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium">Sign up in World App to receive USDC</h3>
        <p className="text-sm text-[var(--ink-secondary)]">
          DevDrip sends payouts to your World Wallet. Open the DevDrip Mini App to set up your
          wallet + ID.
        </p>
      </div>
      {qrSvg && (
        <div
          className="shrink-0 rounded-md border border-[var(--rule-default)] bg-white p-2"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      )}
    </div>
  )
}
