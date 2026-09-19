import { eq } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { onchainPools } from "../db/schema/onchain_pools.js"
import { readVol, priceFromTick } from "../lib/onchain-chain.js"

// hook fee math mirrored off-chain for display: BASE_FEE=3000 pips, VOL_K=50, MAX_FEE=10000 (pips, 1e-6).
const BASE_FEE = 3000,
  VOL_K = 50,
  MAX_FEE = 10000

export function feeBpsFromVol(volBps: number): number {
  const pips = Math.min(MAX_FEE, BASE_FEE + volBps * VOL_K)
  return Math.round(pips / 100) // pips → bps
}

export async function poolSnapshot(poolId: string) {
  const db = getDb()
  const [pool] = await db
    .select()
    .from(onchainPools)
    .where(eq(onchainPools.poolId, poolId))
    .limit(1)
  if (!pool) return null
  const { tick, volBps } = await readVol(pool.hookAddress, poolId)
  return {
    poolId,
    poolLabel: pool.label,
    tick,
    price: priceFromTick(tick, pool.token0Decimals, pool.token1Decimals),
    volBps,
    feeBps: feeBpsFromVol(volBps),
    asOf: new Date().toISOString(),
  }
}
