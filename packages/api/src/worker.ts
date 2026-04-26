// Worker process entry — runs as a SEPARATE Railway service from the API.
// Spawns the settlement loop and (in a later commit) the auto-disburse cron.
// Mirrors src/index.ts in shape: probes, error handlers, graceful shutdown.

import "dotenv/config"
import { env, assertEnvSafe } from "./config/env.js"
import { logger } from "./lib/logger.js"
import { probeDb, probeRedis } from "./lib/probes.js"
import { startSettlementLoop, stopSettlementLoop } from "./workers/settlement.js"
import { startAutoDisburseCron, tick as runDisburseOnce } from "./workers/auto-disburse.js"

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

  if (process.argv.includes("--once-disburse")) {
    logger.info("running auto-disburse once and exiting")
    await runDisburseOnce()
    process.exit(0)
  }

  // Fail fast if the hot wallet env vars aren't set — worker can't function
  // without them. Reading the getter triggers requireEnv which throws.
  const hotWallet = env.hotWalletAddress
  logger.info({ hotWallet }, "worker starting; hot wallet configured")

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

  startSettlementLoop()
  startAutoDisburseCron()

  function shutdown(signal: string): void {
    logger.info({ signal }, "worker shutting down")
    stopSettlementLoop()
      .then(() => {
        logger.info("settlement loop stopped")
        process.exit(0)
      })
      .catch((err) => {
        logger.error({ err }, "shutdown error")
        process.exit(1)
      })
    setTimeout(() => {
      logger.warn("forced worker shutdown after timeout")
      process.exit(1)
    }, 15_000).unref()
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))
}

start().catch((err) => {
  logger.fatal({ err }, "worker startup failed")
  process.exit(1)
})
