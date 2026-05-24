// Recurring background jobs: news fetch (every 5 min), alert evaluation (every
// 1 min), and a source-health sweep (every 15 min). Extracted from worker.ts so
// the same wiring runs either standalone (worker:start) or in-process from the
// API (index.ts, gated by env.runInprocessWorker) — one container keeps news
// flowing without a second Railway service.

import cron from "node-cron"
import { logger } from "./lib/logger.js"
import { runFetchTick } from "./services/news-fetchers/coordinator.js"
import { runAlertEvaluation } from "./services/alert-evaluator.service.js"
import { runNewsHealthCheck } from "./services/news-health.service.js"

let started = false

export function startScheduler(): void {
  // idempotent — node-cron registrations are process-global, so guard against a
  // double call (e.g. both worker.ts and an accidental in-process start).
  if (started) return
  started = true

  // eager first fetch so a fresh process doesn't wait up to 5 min for news.
  // minuteBucket 0 makes every source "due" regardless of its interval.
  void runFetchTick(0).catch((err) => logger.error({ err }, "initial fetch tick failed"))

  cron.schedule("*/5 * * * *", async () => {
    const minuteBucket = new Date().getMinutes()
    try {
      await runFetchTick(minuteBucket)
    } catch (err) {
      logger.error({ err }, "fetch tick failed")
    }
  })

  // Yahoo quotes aren't persisted (spec §12) — alert eval polls upstream per
  // unique watchlist symbol (Redis-cached), so a 1-min pulse is generous.
  cron.schedule("*/1 * * * *", async () => {
    try {
      await runAlertEvaluation()
    } catch (err) {
      logger.error({ err }, "alert evaluation tick failed")
    }
  })

  cron.schedule("*/15 * * * *", async () => {
    try {
      await runNewsHealthCheck()
    } catch (err) {
      logger.error({ err }, "news health check failed")
    }
  })

  logger.info(
    "scheduler running — news fetch every 5 min, alert eval every 1 min, health sweep every 15 min"
  )
}
