import { eq, and, gt, sql } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { onchainPositions } from "../db/schema/onchain_positions.js"
import { onchainPools } from "../db/schema/onchain_pools.js"
import { onchainEvents } from "../db/schema/onchain_events.js"
import { devices } from "../db/schema/devices.js"
import { getRedis } from "../lib/redis.js"
import { pendingAlertsKey } from "../lib/onchain-keys.js"
import { readVol } from "../lib/onchain-chain.js"
import { logger } from "../lib/logger.js"

const PENDING_TTL_SEC = 60 * 60

export async function runOnchainEvaluation(): Promise<void> {
  const db = getDb()
  const positions = await db
    .select()
    .from(onchainPositions)
    .where(eq(onchainPositions.status, "active"))
  if (positions.length === 0) return
  const redis = getRedis()

  for (const pos of positions) {
    try {
      const [pool] = await db
        .select()
        .from(onchainPools)
        .where(eq(onchainPools.poolId, pos.poolId))
        .limit(1)
      if (!pool) continue
      const { tick } = await readVol(pool.hookAddress, pos.poolId)
      const breached = tick < pos.tickLower || tick > pos.tickUpper
      if (!breached) continue

      const userDevices = await db
        .select({ id: devices.id })
        .from(devices)
        .where(eq(devices.userId, pos.userId))
      for (const d of userDevices) {
        const recent = await db
          .select({ id: onchainEvents.id })
          .from(onchainEvents)
          .where(
            and(
              eq(onchainEvents.deviceId, d.id),
              eq(onchainEvents.type, "range_breach"),
              gt(onchainEvents.firedAt, sql`now() - interval '60 minutes'`)
            )
          )
          .limit(1)
        if (recent.length > 0) continue

        const alert = {
          positionId: pos.id,
          type: "range_breach" as const,
          message: `price out of range (${pool.label})`,
          firedAt: new Date().toISOString(),
        }
        // lpush + expire FIRST so a redis failure doesn't consume the debounce window
        await redis.lpush(pendingAlertsKey(d.id), alert)
        await redis.expire(pendingAlertsKey(d.id), PENDING_TTL_SEC)
        await db.insert(onchainEvents).values({
          userId: pos.userId,
          deviceId: d.id,
          positionId: pos.id,
          type: "range_breach",
          payload: { tick, lower: pos.tickLower, upper: pos.tickUpper },
        })
        logger.info({ positionId: pos.id, deviceId: d.id, tick }, "onchain range_breach fired")
      }
    } catch (err) {
      logger.error({ err: String(err), positionId: pos.id }, "onchain eval failed — continuing")
    }
  }
}
