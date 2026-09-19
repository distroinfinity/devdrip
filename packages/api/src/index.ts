import "dotenv/config"
import { app } from "./app.js"
import { env } from "./config/env.js"
import { logger } from "./lib/logger.js"
import { probeDb, probeRedis } from "./lib/probes.js"
import type { Socket } from "node:net"

async function start() {
  const [dbResult, redisResult] = await Promise.allSettled([probeDb(), probeRedis()])

  if (dbResult.status === "fulfilled") {
    logger.info("db connection ok")
  } else {
    logger.fatal({ err: dbResult.reason }, "db connection failed — exiting")
    process.exit(1)
  }

  if (redisResult.status === "fulfilled") {
    logger.info("redis connection ok")
  } else {
    logger.warn({ err: redisResult.reason }, "redis connection failed")
  }

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
