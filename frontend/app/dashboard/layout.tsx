import { redirect } from "next/navigation"
import { ChannelMode } from "@distrotv/shared"
import { AppShell } from "@/components/dashboard/app-shell"
import { getSession } from "@/lib/session"
import { apiFetchOrRefresh } from "@/lib/api"
import type { PreferencesPayload } from "@/lib/dashboard-api"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect("/sign-in")

  // fetch prefs server-side so the mode toggle's initial state matches the
  // user's saved value without a client-side waterfall.
  let initialMode: ChannelMode = ChannelMode.Mix
  try {
    const { preferences } = await apiFetchOrRefresh<PreferencesPayload>(
      "/me/preferences",
      "/dashboard"
    )
    initialMode = preferences.channelMode
  } catch {
    // if prefs fetch fails, default to Mix — the toggle shows "both" until the user clicks something
  }

  return (
    <AppShell user={session} initialMode={initialMode}>
      {children}
    </AppShell>
  )
}
