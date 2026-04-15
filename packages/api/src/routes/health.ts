import { Router } from "express"
import { probeDb, probeRedis } from "../lib/probes.js"

export const healthRouter: ReturnType<typeof Router> = Router()

healthRouter.get("/", async (_req, res) => {
  const [dbResult, redisResult] = await Promise.allSettled([probeDb(), probeRedis()])

  const db =
    dbResult.status === "fulfilled"
      ? { status: "ok" as const }
      : { status: "error" as const, error: (dbResult.reason as Error).message }

  const redis =
    redisResult.status === "fulfilled"
      ? { status: "ok" as const }
      : { status: "error" as const, error: (redisResult.reason as Error).message }

  const allOk = db.status === "ok" && redis.status === "ok"

  await res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    components: { db, redis },
  })
})
