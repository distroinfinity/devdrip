import { Router } from "express"
import { logger } from "../lib/logger.js"
import { probeDb, probeRedis } from "../lib/probes.js"

export const healthRouter: ReturnType<typeof Router> = Router()

function toComponentStatus(result: PromiseSettledResult<void>, name: string) {
  if (result.status === "fulfilled") return { status: "ok" as const }
  logger.error({ err: result.reason }, `${name} probe failed`)
  return { status: "error" as const, error: "unavailable" }
}

healthRouter.get("/", async (_req, res) => {
  const [dbResult, redisResult] = await Promise.allSettled([probeDb(), probeRedis()])

  const db = toComponentStatus(dbResult, "db")
  const redis = toComponentStatus(redisResult, "redis")

  // only DB failure is fatal — redis is non-critical (rate limiting fails open)
  const dbOk = db.status === "ok"
  const allOk = dbOk && redis.status === "ok"

  await res.status(dbOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    components: { db, redis },
  })
})
