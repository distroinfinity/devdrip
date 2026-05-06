// Worker process — runs the news fetcher coordinator on a 5-min tick.
// M4 will add the ticker fetcher cron alongside this one.

import "dotenv/config"
import cron from "node-cron"
import { env, assertEnvSafe } from "./config/env.js"
import { logger } from "./lib/logger.js"
import { probeDb, probeRedis } from "./lib/probes.js"
import { runFetchTick } from "./services/news-fetchers/coordinator.js"

process.on("unhandledRejection", (reason, promise) => {
  console.error("[worker] unhandledRejection at:", promise, "reason:", reason)
  logger.error({ err: reason }, "worker unhandledRejection")
})

process.on("uncaughtException", (err) => {
  console.error("[worker] uncaughtException:", err)
  logger.fatal({ err }, "worker uncaughtException")
  if (env.nodeEnv === "production") process.exit(1)
})

async function start(): Promise<void> {
  assertEnvSafe()

  const [dbResult, redisResult] = await Promise.allSettled([probeDb(), probeRedis()])
  if (dbResult.status === "rejected") {
    logger.fatal({ err: dbResult.reason }, "db connection failed — exiting")
    process.exit(1)
  }
  logger.info("db connection ok")
  if (redisResult.status === "fulfilled") {
    logger.info("redis connection ok")
  } else {
    logger.warn({ err: redisResult.reason }, "redis connection failed (worker continues)")
  }

  void runFetchTick(0).catch((err) => logger.error({ err }, "initial fetch tick failed"))

  cron.schedule("*/5 * * * *", async () => {
    const minuteBucket = new Date().getMinutes()
    try {
      await runFetchTick(minuteBucket)
    } catch (err) {
      logger.error({ err }, "fetch tick failed")
    }
  })

  logger.info("worker running — news fetch every 5 min")
}

start().catch((err) => {
  logger.fatal({ err }, "worker startup failed")
  process.exit(1)
})
