import cron from "node-cron"
import { logger } from "./logger.js"
import { runFetchTick } from "../services/news-fetchers/coordinator.js"
import { runAlertEvaluation } from "../services/alert-evaluator.service.js"

// schedules the periodic jobs: news fetch (populates news_items) every 5 min
// with an immediate tick on start, and alert evaluation every 1 min. used by
// both the standalone worker (worker.ts) and, for now, the api process in-line
// (no dedicated worker service is deployed yet — fine at current scale).
export function startBackgroundJobs(): void {
  void runFetchTick(0).catch((err) => logger.error({ err }, "initial fetch tick failed"))

  cron.schedule("*/5 * * * *", async () => {
    try {
      await runFetchTick(new Date().getMinutes())
    } catch (err) {
      logger.error({ err }, "fetch tick failed")
    }
  })

  cron.schedule("*/1 * * * *", async () => {
    try {
      await runAlertEvaluation()
    } catch (err) {
      logger.error({ err }, "alert evaluation tick failed")
    }
  })

  logger.info("background jobs scheduled — news fetch every 5 min, alert eval every 1 min")
}
