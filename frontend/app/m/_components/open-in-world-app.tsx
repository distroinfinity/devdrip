"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"

const WORLD_APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID ?? ""

export function OpenInWorldApp() {
  const [qrSvg, setQrSvg] = useState<string>("")
  const [copied, setCopied] = useState(false)

  // Mini-app deeplink; opens the DevDrip Mini App inside World App.
  const deeplink = `https://world.org/mini-app?app_id=${WORLD_APP_ID}`

  useEffect(() => {
    void QRCode.toString(deeplink, { type: "svg", width: 256, margin: 1 }).then(setQrSvg)
  }, [deeplink])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[var(--bg-primary)] px-6 text-[var(--ink-primary)]">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-semibold">DevDrip Mini App</h1>
        <p className="text-[var(--ink-secondary)]">
          This page only works inside the World App. Scan the QR with your phone or open the link
          below.
        </p>
        {qrSvg && (
          <div
            className="rounded-md border border-[var(--border-subtle)] bg-white p-3"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        )}
        <a
          href={deeplink}
          className="text-sm text-[var(--accent)] underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {deeplink}
        </a>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(deeplink).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            })
          }}
          className="text-xs text-[var(--ink-secondary)] underline"
        >
          {copied ? "copied" : "copy link"}
        </button>
      </div>
    </main>
  )
}
