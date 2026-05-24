// Standalone worker entrypoint — boots the shared scheduler (news fetch + alert
// eval + health sweep) in its own process. The same startScheduler() also runs
// in-process from the API (see index.ts) so prod doesn't need this as a separate
// Railway service; keep it for local `worker:dev` and future scale-out.

import "dotenv/config"
import { env, assertEnvSafe } from "./config/env.js"
import { logger } from "./lib/logger.js"
import { probeDb, probeRedis } from "./lib/probes.js"
import { sendSlackAlert } from "./lib/slack.js"
import { startScheduler } from "./scheduler.js"

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

  startScheduler()

  const sha = env.commitSha?.slice(0, 7) ?? "unknown"
  void sendSlackAlert(`worker booted · sha=${sha}`, { severity: "info" })
}

start().catch((err) => {
  logger.fatal({ err }, "worker startup failed")
  process.exit(1)
})
