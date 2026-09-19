import express, { type Express, type Request } from "express"
import cookieParser from "cookie-parser"
import cors from "cors"
import helmet from "helmet"
import { pinoHttp } from "pino-http"
import { env } from "./config/env.js"
import { logger } from "./lib/logger.js"
import { errorHandler } from "./errors/error-handler.js"
import { healthRouter } from "./routes/health.js"
import { authRouter } from "./routes/auth.js"
import { devicesRouter } from "./routes/devices.js"
import { advertisersRouter } from "./routes/advertisers.js"
import { campaignsRouter } from "./routes/campaigns.js"
import { requireAuth } from "./middleware/auth.js"
import { requireAdmin } from "./middleware/admin.js"
import { globalLimiter, userLimiter, adminLimiter } from "./middleware/rate-limit.js"

const REDACTED_HEADERS = new Set(["authorization", "cookie", "set-cookie"])

export const app: Express = express()
app.set("trust proxy", 1)
app.use(helmet())
app.use(cors({ origin: env.allowedOrigins, credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(raw: Request) {
        const headers: Record<string, string | string[] | undefined> = {}
        for (const [k, v] of Object.entries(raw.headers)) {
          headers[k] = REDACTED_HEADERS.has(k) ? "[redacted]" : v
        }
        return { method: raw.method, url: raw.url, headers }
      },
    },
  })
)

app.use("/health", healthRouter)

app.use(globalLimiter)

app.use("/auth", authRouter)
app.use("/devices", requireAuth, devicesRouter)
app.use("/advertisers", requireAdmin, adminLimiter, advertisersRouter)
app.use("/campaigns", requireAdmin, adminLimiter, campaignsRouter)

app.get("/me", requireAuth, userLimiter, async (_req, res) => {
  await res.json({ userId: res.locals["userId"], githubLogin: res.locals["githubLogin"] })
})

app.use(errorHandler)
