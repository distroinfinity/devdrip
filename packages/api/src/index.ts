import "dotenv/config"
import express from "express"
import type { Request, Response, NextFunction } from "express"
import cookieParser from "cookie-parser"
import cors from "cors"
import helmet from "helmet"
import { env } from "./config/env.js"
import { authRouter } from "./routes/auth.js"
import { devicesRouter } from "./routes/devices.js"
import { requireAuth } from "./middleware/auth.js"
import { globalLimiter, userLimiter } from "./middleware/rate-limit.js"

const app = express()
app.set("trust proxy", 1)
app.use(helmet())
app.use(cors({ origin: env.allowedOrigins, credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.get("/health", async (_req, res) => {
  await res.json({ ok: true })
})

app.use(globalLimiter)

app.use("/auth", authRouter)
app.use("/devices", requireAuth, devicesRouter)

app.get("/me", requireAuth, userLimiter, async (_req, res) => {
  await res.json({ userId: res.locals["userId"], githubLogin: res.locals["githubLogin"] })
})

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("unhandled error:", err)
  res.status(500).json({ error: err.message })
})

app.listen(env.port, () => {
  console.log(`api listening on :${env.port} [${env.nodeEnv}]`)
})
