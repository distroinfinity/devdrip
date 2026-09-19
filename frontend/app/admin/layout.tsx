import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getSession } from "@/lib/session"
import { adminApi } from "@/lib/admin-api"
import { SystemStateReadout } from "@/components/admin/system-state-readout"
import { AdminPathnameShell } from "./pathname-shell"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect("/sign-in?next=/")

  let overview: Awaited<ReturnType<typeof adminApi.overview>> | null = null
  let systemHealth: Awaited<ReturnType<typeof adminApi.systemHealth>> | null = null
  let isAdminOk = true
  try {
    overview = await adminApi.overview()
    systemHealth = await adminApi.systemHealth()
  } catch {
    isAdminOk = false
  }

  if (!isAdminOk) {
    const h = await headers()
    const host = h.get("host") ?? ""
    const userHost = host.startsWith("admin.") ? host.slice("admin.".length) : host
    const proto = h.get("x-forwarded-proto") ?? "https"
    redirect(`${proto}://${userHost}/`)
  }

  const apiBootedAt = new Date().toISOString()
  const newsLastFetch =
    systemHealth?.newsSources.find((s) => s.lastFetchedAt != null)?.lastFetchedAt ?? null
  const tickerLastQuote = systemHealth?.tickerProviders[0]?.lastQuoteAt ?? null
  const alertEvalLastTick = overview?.recentAlerts[0]?.firedAt ?? null

  const readout = (
    <SystemStateReadout
      apiBootedAt={apiBootedAt}
      newsLastFetch={newsLastFetch}
      tickerLastQuote={tickerLastQuote}
      alertEvalLastTick={alertEvalLastTick}
      totalUsers={overview?.counts.users ?? 0}
    />
  )

  return <AdminPathnameShell systemStateReadout={readout}>{children}</AdminPathnameShell>
}
