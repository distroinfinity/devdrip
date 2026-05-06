// Worker process entry — settlement + disburse loops removed in M1 rip.
// Placeholder until KeeperHub vault worker is wired in M2.

import "dotenv/config"
import { env, assertEnvSafe } from "./config/env.js"
import { logger } from "./lib/logger.js"
import { probeDb, probeRedis } from "./lib/probes.js"

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

  logger.info("worker idle — vault loop placeholder")
}

start().catch((err) => {
  logger.fatal({ err }, "worker startup failed")
  process.exit(1)
})
