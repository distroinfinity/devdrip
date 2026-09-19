// Recurring background jobs: news fetch (every 5 min), alert evaluation (every
// 1 min), and a source-health sweep (every 15 min). Extracted from worker.ts so
// the same wiring runs either standalone (worker:start) or in-process from the
// API (index.ts, gated by env.runInprocessWorker) — one container keeps news
// flowing without a second Railway service.

import cron from "node-cron"
import { getRedis } from "./lib/redis.js"
import { logger } from "./lib/logger.js"
import { runFetchTick } from "./services/news-fetchers/coordinator.js"
import { runAlertEvaluation } from "./services/alert-evaluator.service.js"
import { runNewsHealthCheck } from "./services/news-health.service.js"

let started = false

// Per-tick leader lock. With the scheduler now running in-process in EVERY api
// instance (env.runInprocessWorker), more than one instance would otherwise run
// the same tick — harmless for news (per-source locks dedupe writes) but a real
// duplicate-fanout bug for alert evaluation (no per-row uniqueness). The lock is
// keyed by a time bucket so each tick is claimed by exactly one instance, and it
// simply expires (no release) so the next bucket re-arms cleanly.
async function runLocked(
  name: string,
  bucketMs: number,
  ttlSec: number,
  fn: () => Promise<void>
): Promise<void> {
  const bucket = Math.floor(Date.now() / bucketMs)
  const key = `scheduler:lock:${name}:${bucket}`
  const got = await getRedis().set(key, "1", { nx: true, ex: ttlSec })
  if (!got) {
    logger.debug({ name, bucket }, "scheduler tick skipped — another instance holds the lock")
    return
  }
  await fn()
}

export function startScheduler(): void {
  // idempotent — node-cron registrations are process-global, so guard against a
  // double call (e.g. both worker.ts and an accidental in-process start).
  if (started) return
  started = true

  // eager first fetch so a fresh process doesn't wait up to 5 min for news.
  // minuteBucket 0 makes every source "due" regardless of its interval. left
  // unlocked: per-source Redis locks in the coordinator already dedupe writes.
  void runFetchTick(0).catch((err) => logger.error({ err }, "initial fetch tick failed"))

  cron.schedule("*/5 * * * *", () => {
    const minuteBucket = new Date().getMinutes()
    void runLocked("fetch", 300_000, 280, () => runFetchTick(minuteBucket)).catch((err) =>
      logger.error({ err }, "fetch tick failed")
    )
  })

  // Yahoo quotes aren't persisted (spec §12) — alert eval polls upstream per
  // unique watchlist symbol (Redis-cached), so a 1-min pulse is generous.
  // MUST stay locked: fireForUser is read-debounce → lpush → insert with no
  // per-row uniqueness, so two instances racing would double-fire alerts.
  cron.schedule("*/1 * * * *", () => {
    void runLocked("alert", 60_000, 55, runAlertEvaluation).catch((err) =>
      logger.error({ err }, "alert evaluation tick failed")
    )
  })

  cron.schedule("*/15 * * * *", () => {
    void runLocked("health", 900_000, 840, runNewsHealthCheck).catch((err) =>
      logger.error({ err }, "news health check failed")
    )
  })

  logger.info(
    "scheduler running — news fetch every 5 min, alert eval every 1 min, health sweep every 15 min"
  )
}
