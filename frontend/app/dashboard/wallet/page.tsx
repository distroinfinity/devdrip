import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getServerUser } from "@/lib/auth"
import { WalletSummary } from "./_components/wallet-summary"
import { OnboardingBanner } from "./_components/onboarding-banner"
import { PayoutHistory } from "@/components/wallet/payout-history"
import type { Balance, PayoutListResult } from "@/lib/wallet-api"

interface MeFull {
  id: string
  walletAddress: string | null
  signedUpAt: string | null
}

export default async function DashboardWalletPage() {
  const user = await getServerUser()
  if (!user) redirect("/sign-in")

  const h = headers()
  const proto = h.get("x-forwarded-proto") ?? "http"
  const host = h.get("host") ?? "localhost:3000"
  const origin = `${proto}://${host}`
  const cookieHeader = h.get("cookie") ?? ""

  // Use the existing /me (Bearer cookie) for full user fields, plus
  // /me/balance and /me/payouts for chain state. All three go through the
  // same-origin /api/* rewrite.
  const [me, balance, payouts] = await Promise.all([
    fetch(`${origin}/api/me`, { headers: { cookie: cookieHeader }, cache: "no-store" }).then(
      (r) => r.json() as Promise<MeFull>
    ),
    fetch(`${origin}/api/me/balance`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    }).then((r) => r.json() as Promise<Balance>),
    fetch(`${origin}/api/me/payouts?limit=20`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    }).then((r) => r.json() as Promise<PayoutListResult>),
  ])

  const needsOnboarding = !me.signedUpAt

  return (
    <div className="flex flex-col gap-6">
      {needsOnboarding && <OnboardingBanner />}
      <WalletSummary
        walletAddress={me.walletAddress}
        available={balance.availableUsdc}
        lifetime={balance.lifetimeEarnedUsdc}
        pending={balance.pendingPayoutsUsdc}
      />
      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--ink-secondary)]">Payout history</h2>
        <PayoutHistory items={payouts.items} />
      </section>
    </div>
  )
}
