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
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Pick your channels</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            These feed your terminal slot. You can change this anytime from the dashboard.
          </p>
        </div>
        <ChannelsClientImpl initial={channels} />
      </div>
    </main>
  )
}
