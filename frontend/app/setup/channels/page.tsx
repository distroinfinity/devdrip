import { redirect } from "next/navigation"
import { apiFetchOrRefresh } from "@/lib/api"
import { getSession } from "@/lib/session"
import type { ChannelDto } from "@distrotv/shared"
import { ChannelsClientImpl } from "./channels-client"

export default async function SetupChannelsPage() {
  const session = await getSession()
  if (!session) redirect("/setup")

  const { channels } = await apiFetchOrRefresh<{ channels: ChannelDto[] }>(
    "/me/channels",
    "/setup/channels"
  )

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-[var(--bg-primary)]">
      <div className="max-w-lg w-full space-y-6">
        <div>
          <h1 className="font-[var(--font-display)] text-[22px] font-bold tracking-[-0.02em] text-[var(--ink-primary)]">
            Pick your channels
          </h1>
          <p className="mt-2 text-[13px] font-[var(--font-body)] text-[var(--ink-secondary)]">
            These feed your terminal slot. You can change this anytime from the dashboard.
          </p>
        </div>
        <ChannelsClientImpl initial={channels} />
      </div>
    </main>
  )
}
