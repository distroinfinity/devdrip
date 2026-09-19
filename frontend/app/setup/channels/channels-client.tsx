"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ChannelDto } from "@distrotv/shared"
import { ChannelsGrid } from "@/components/dashboard/preferences/channels-grid"
import { SharpButton } from "@/components/v5/sharp-button"
import { saveChannelsFromSetup } from "./actions"

export function ChannelsClientImpl({ initial }: { initial: ChannelDto[] }) {
  const [channels, setChannels] = useState(initial)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function onSave() {
    setError(null)
    const subscribedKeys = channels.filter((c) => c.subscribed).map((c) => c.key)
    if (subscribedKeys.length === 0) {
      setError("pick at least one channel to continue")
      return
    }
    start(async () => {
      const result = await saveChannelsFromSetup(subscribedKeys)
      if (result.ok) {
        router.push("/setup/watchlist")
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      <ChannelsGrid channels={channels} onChange={setChannels} disabled={pending} />
      {error && (
        <p className="font-[var(--font-data)] text-[11px] text-[var(--status-negative)]">{error}</p>
      )}
      <SharpButton
        type="button"
        variant="primary"
        onClick={onSave}
        disabled={pending}
        className="w-full"
      >
        {pending ? "saving…" : "Save and continue"}
      </SharpButton>
    </div>
  )
}
