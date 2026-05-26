import { BlurFade } from "@distrotv/design-system/components/blur-fade"
import { apiFetchOrRefresh } from "@/lib/api"
import type { OnchainPosition, PoolSnapshot } from "@/lib/dashboard-api"
import { OnchainClient } from "./onchain-client"

export const dynamic = "force-dynamic"

// demo pool — mWETH/mUSDC on base sepolia. prefilled in the register form too.
const DEMO_POOL_ID = "0xe6d570f5d75318142a44ff50c345bbdca0e57786430d14adb7786d39dec6a2b7"

export default async function OnchainPage() {
  const [{ positions }, snapshot] = await Promise.all([
    apiFetchOrRefresh<{ positions: OnchainPosition[] }>(
      "/me/onchain/positions",
      "/dashboard/onchain"
    ),
    // public endpoint — tolerate failure so the page still renders the rest
    apiFetchOrRefresh<PoolSnapshot>(`/onchain/pools/${DEMO_POOL_ID}`, "/dashboard/onchain").catch(
      () => null
    ),
  ])

  return (
    <div className="flex flex-col gap-6">
      <BlurFade delay={0} direction="up" offset={6}>
        <div>
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
            LP Guard
          </p>
          <h1 className="mt-2 font-display text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--ink-primary)] md:text-[40px]">
            on-chain positions
          </h1>
          <p className="mt-2 font-body text-[13px] text-[var(--ink-secondary)]">
            watch your uniswap v4 liquidity. the dynamic fee climbs with volatility — your terminal
            surfaces a guard slot the moment price drifts toward a range edge.
          </p>
        </div>
      </BlurFade>

      <BlurFade delay={0.04} direction="up" offset={6}>
        <OnchainClient initial={positions} snapshot={snapshot} demoPoolId={DEMO_POOL_ID} />
      </BlurFade>
    </div>
  )
}
