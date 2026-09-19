// Auto-disburse cron — every Sunday 00:00 UTC. Inserts pending payouts for
// users with balance ≥ $5 via a single idempotent INSERT...SELECT. The
// settlement loop picks them up on its next tick.

import cron from "node-cron"
import { runAutoDisburse } from "../services/auto-disburse.service.js"
import { logger } from "../lib/logger.js"

const SCHEDULE = "0 0 * * 0"

export function startAutoDisburseCron(): void {
  logger.info({ schedule: SCHEDULE }, "auto-disburse cron starting")
  cron.schedule(
    SCHEDULE,
    () => {
      void tick()
    },
    { timezone: "UTC" }
  )
}

export async function tick(): Promise<void> {
  try {
    const summary = await runAutoDisburse()
    logger.info({ inserted: summary.inserted }, "auto-disburse tick complete")
  } catch (err) {
    logger.error({ err }, "auto-disburse tick failed")
  }
}
