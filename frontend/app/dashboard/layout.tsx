import { redirect } from "next/navigation"
import { ChannelMode } from "@distrotv/shared"
import type { SyncedPreferences, ChannelDto, WatchlistDto, AlertDto } from "@distrotv/shared"
import { AppShell } from "@/components/dashboard/app-shell"
import { ConfigReadout } from "@/components/dashboard/sidebar/config-readout"
import { getSession } from "@/lib/session"
import { apiFetchOrRefresh } from "@/lib/api"
import type { PreferencesPayload } from "@/lib/dashboard-api"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect("/sign-in")

  // fetch prefs server-side so the mode pill's initial state matches the
  // user's saved value without a client-side waterfall.
  let initialMode: ChannelMode = ChannelMode.Balanced
  let prefs: SyncedPreferences | null = null
  try {
    const { preferences } = await apiFetchOrRefresh<PreferencesPayload>(
      "/me/preferences",
      "/dashboard"
    )
    prefs = preferences
    initialMode = preferences.channelMode
  } catch {
    // if prefs fetch fails, default to Mix
  }

  const [channelsRes, watchlistsRes, alertsRes] = await Promise.all([
    apiFetchOrRefresh<{ channels: ChannelDto[] }>("/me/channels", "/dashboard").catch(() => ({
      channels: [] as ChannelDto[],
    })),
    apiFetchOrRefresh<{ watchlists: WatchlistDto[] }>("/me/watchlists", "/dashboard").catch(() => ({
      watchlists: [] as WatchlistDto[],
    })),
    apiFetchOrRefresh<{ alerts: AlertDto[] }>("/me/alerts", "/dashboard").catch(() => ({
      alerts: [] as AlertDto[],
    })),
  ])

  const watchlistTickers =
    watchlistsRes.watchlists[0]?.tickers?.map((t: { symbol: string }) => t.symbol) ?? []
  const globalAlertThreshold =
    alertsRes.alerts.find((a: AlertDto) => a.scope === "global")?.thresholdPct ?? null

  const configReadout = prefs ? (
    <ConfigReadout
      prefs={prefs}
      channels={channelsRes.channels}
      watchlistTickers={watchlistTickers}
      globalAlertThreshold={globalAlertThreshold}
    />
  ) : null

  return (
    <AppShell user={session} initialMode={initialMode} configReadout={configReadout}>
      {children}
    </AppShell>
  )
}
