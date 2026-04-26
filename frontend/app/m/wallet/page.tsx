import { headers, cookies } from "next/headers"
import { redirect } from "next/navigation"
import { MiniAppShell } from "../_components/mini-app-shell"
import { BalanceCard } from "./_components/balance-card"
import { PayoutHistory } from "@/components/wallet/payout-history"
import { fetchMiniAppMe } from "@/lib/miniapp-api"
import type { Balance, PayoutListResult } from "@/lib/wallet-api"

// Server component. Fetches /miniapp/me + /me/balance + /me/payouts using the
// dd_miniapp cookie via same-origin rewrites. We forward the cookie header
// explicitly because the server-side fetch doesn't otherwise carry browser cookies.
export default async function WalletPage() {
  const h = headers()
  const cookieHeader = h.get("cookie") ?? cookies().toString()
  const proto = h.get("x-forwarded-proto") ?? "http"
  const host = h.get("host") ?? "localhost:3000"
  const origin = `${proto}://${host}`

  // Auth gate: if no Mini App cookie, push to signup.
  const me = await fetchMiniAppMe({ cookieHeader, origin }).catch(() => null)
  if (!me) redirect("/m/signup")

  const [balance, payouts] = await Promise.all([
    fetch(`${origin}/api/me/balance`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    }).then((r) => r.json() as Promise<Balance>),
    fetch(`${origin}/api/me/payouts?limit=20`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    }).then((r) => r.json() as Promise<PayoutListResult>),
  ])

  return (
    <MiniAppShell title="Wallet">
      <div className="flex flex-col gap-6">
        <BalanceCard
          available={balance.availableUsdc}
          lifetime={balance.lifetimeEarnedUsdc}
          pending={balance.pendingPayoutsUsdc}
        />
        <section>
          <h2 className="mb-3 text-sm font-medium text-[var(--ink-secondary)]">Payout history</h2>
          <PayoutHistory items={payouts.items} />
        </section>
      </div>
    </MiniAppShell>
  )
}
