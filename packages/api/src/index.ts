import "dotenv/config"
import { app } from "./app.js"
import { env, assertEnvSafe } from "./config/env.js"
import { logger } from "./lib/logger.js"
import { probeDb, probeRedis } from "./lib/probes.js"
import { ensureCarbonSystemCampaign } from "./lib/carbon-system-campaign.js"
import { deactivateStaleCarbonCreatives } from "./services/carbon-cleanup.service.js"
import type { Socket } from "node:net"

async function start() {
  assertEnvSafe()

  const [dbResult, redisResult] = await Promise.allSettled([probeDb(), probeRedis()])

  if (dbResult.status === "fulfilled") {
    logger.info("db connection ok")
  } else {
    logger.fatal({ err: dbResult.reason }, "db connection failed — exiting")
    process.exit(1)
  }

  await ensureCarbonSystemCampaign()

  if (redisResult.status === "fulfilled") {
    logger.info("redis connection ok")
  } else {
    logger.warn({ err: redisResult.reason }, "redis connection failed")
  }

  // deactivate stale carbon creatives every 12 hours
  const CLEANUP_INTERVAL_MS = 12 * 60 * 60 * 1000
  const cleanupTimer = setInterval(() => {
    deactivateStaleCarbonCreatives().catch((err) => {
      logger.warn({ err }, "carbon cleanup failed")
    })
  }, CLEANUP_INTERVAL_MS)
  cleanupTimer.unref()

  const server = app.listen(env.port, () => {
    logger.info({ port: env.port }, "api listening")
  })

  const openSockets = new Set<Socket>()
  server.on("connection", (socket) => {
    openSockets.add(socket)
    socket.on("close", () => openSockets.delete(socket))
  })

  function shutdown(signal: string) {
    logger.info({ signal }, "shutting down")
    clearInterval(cleanupTimer)
    for (const socket of openSockets) socket.destroy()
    server.close(() => {
      logger.info("http server closed")
      process.exit(0)
    })
    setTimeout(() => {
      logger.warn("forced shutdown after timeout")
      process.exit(1)
    }, 10_000).unref()
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))
}

start().catch((err) => {
  logger.fatal({ err }, "startup failed")
  process.exit(1)
})
