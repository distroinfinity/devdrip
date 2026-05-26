import { eq, and, asc } from "drizzle-orm"
import type { OnchainPayload, OnchainAlert } from "@distrotv/shared"
import { getDb } from "../db/index.js"
import { onchainPositions } from "../db/schema/onchain_positions.js"
import { onchainPools } from "../db/schema/onchain_pools.js"
import { getRedis } from "../lib/redis.js"
import { pendingAlertsKey } from "../lib/onchain-keys.js"
import { readVol, priceFromTick } from "../lib/onchain-chain.js"
import { feeBpsFromVol } from "./onchain-snapshot.service.js"

interface PendingOnchainAlert extends OnchainAlert {
  positionId: string
}

export async function nextOnchainForDevice(args: {
  userId: string
  deviceId: string
}): Promise<OnchainPayload | null> {
  const db = getDb()
  const redis = getRedis()

  const pending = await redis.lpop<PendingOnchainAlert>(pendingAlertsKey(args.deviceId))
  if (pending) {
    const payload = await buildPayload(args.userId, pending.positionId)
    if (payload)
      return {
        ...payload,
        alert: { type: pending.type, message: pending.message, firedAt: pending.firedAt },
      }
  }

  const [pos] = await db
    .select()
    .from(onchainPositions)
    .where(and(eq(onchainPositions.userId, args.userId), eq(onchainPositions.status, "active")))
    .orderBy(asc(onchainPositions.createdAt))
    .limit(1)
  if (!pos) return null
  return buildPayload(args.userId, pos.id)
}

async function buildPayload(userId: string, positionId: string): Promise<OnchainPayload | null> {
  const db = getDb()
  const [pos] = await db
    .select()
    .from(onchainPositions)
    .where(eq(onchainPositions.id, positionId))
    .limit(1)
  if (!pos || pos.userId !== userId) return null
  const [pool] = await db
    .select()
    .from(onchainPools)
    .where(eq(onchainPools.poolId, pos.poolId))
    .limit(1)
  if (!pool) return null
  const { tick, volBps } = await readVol(pool.hookAddress, pos.poolId)
  const price = priceFromTick(tick, pool.token0Decimals, pool.token1Decimals)
  return {
    kind: "onchain",
    poolId: pos.poolId,
    poolLabel: pool.label,
    price,
    tick,
    rangeLower: pos.tickLower,
    rangeUpper: pos.tickUpper,
    inRange: tick >= pos.tickLower && tick <= pos.tickUpper,
    feeBps: feeBpsFromVol(volBps),
    volBps,
    feesEarnedUsd: 0,
    ilPct: 0,
    layout: "single",
    asOf: new Date().toISOString(),
    positionId: pos.id,
  }
}
