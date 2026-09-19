import express, { type Express, type Request } from "express"
import cookieParser from "cookie-parser"
import cors from "cors"
import helmet from "helmet"
import { pinoHttp } from "pino-http"
import { eq } from "drizzle-orm"
import { env } from "./config/env.js"
import { logger } from "./lib/logger.js"
import { errorHandler } from "./errors/error-handler.js"
import { healthRouter } from "./routes/health.js"
import { authRouter } from "./routes/auth.js"
import { devicesRouter } from "./routes/devices.js"
import { advertisersRouter } from "./routes/advertisers.js"
import { campaignsRouter } from "./routes/campaigns.js"
import { adsRouter } from "./routes/ads.js"
import { impressionsRouter } from "./routes/impressions.js"
import { clicksRouter } from "./routes/clicks.js"
import { adminStatsRouter } from "./routes/admin-stats.js"
import { adminUsersRouter } from "./routes/admin-users.js"
import { adminPayoutsRouter } from "./routes/admin-payouts.js"
import { invitesRouter } from "./routes/invites.js"
import { requireAuth } from "./middleware/auth.js"
import { requireAdmin } from "./middleware/admin.js"
import { globalLimiter, userLimiter, adminLimiter } from "./middleware/rate-limit.js"
import { getDb } from "./db/index.js"
import { users } from "./db/schema/users.js"

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
app.use("/admin/stats", requireAdmin, adminLimiter, adminStatsRouter)
app.use("/admin/users", requireAdmin, adminLimiter, adminUsersRouter)
app.use("/admin/payouts", requireAdmin, adminLimiter, adminPayoutsRouter)
app.use("/invites", requireAdmin, adminLimiter, invitesRouter)
app.use("/ads", requireAuth, userLimiter, adsRouter)
app.use("/impressions", requireAuth, userLimiter, impressionsRouter)
app.use("/clicks", requireAuth, userLimiter, clicksRouter)

app.get("/me", requireAuth, userLimiter, async (_req, res) => {
  const userId = res.locals["userId"] as string
  const [row] = await getDb()
    .select({
      id: users.id,
      githubLogin: users.githubLogin,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!row) {
    await res.status(404).json({ error: "user_not_found" })
    return
  }
  await res.json(row)
})

app.use(errorHandler)
