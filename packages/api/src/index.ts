import "dotenv/config"
import express from "express"
import type { Request, Response, NextFunction } from "express"
import cookieParser from "cookie-parser"
import { pinoHttp } from "pino-http"
import { env } from "./config/env.js"
import { logger } from "./lib/logger.js"
import { probeDb, probeRedis } from "./lib/probes.js"
import { healthRouter } from "./routes/health.js"
import { authRouter } from "./routes/auth.js"
import { devicesRouter } from "./routes/devices.js"
import { requireAuth } from "./middleware/auth.js"
import { globalLimiter, userLimiter } from "./middleware/rate-limit.js"

const app = express()
app.set("trust proxy", 1)
app.use(express.json())
app.use(cookieParser())
app.use(pinoHttp({ logger }))

app.use("/health", healthRouter)

app.use(globalLimiter)

app.use("/auth", authRouter)
app.use("/devices", requireAuth, devicesRouter)

app.get("/me", requireAuth, userLimiter, async (_req, res) => {
  await res.json({ userId: res.locals["userId"], githubLogin: res.locals["githubLogin"] })
})

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "unhandled error")
  res.status(500).json({ error: err.message })
})

const server = app.listen(env.port, async () => {
  logger.info({ port: env.port }, "api listening")

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
})

function shutdown(signal: string) {
  logger.info({ signal }, "shutting down")
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
