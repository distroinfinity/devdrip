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
import { ingestRouter } from "./routes/ingest.js"
import { adminStatsRouter } from "./routes/admin-stats.js"
import { adminUsersRouter } from "./routes/admin-users.js"
import { adminPayoutsRouter } from "./routes/admin-payouts.js"
import { invitesRouter } from "./routes/invites.js"
import { mePreferencesRouter } from "./routes/me-preferences.js"
import { meEarningsRouter } from "./routes/me-earnings.js"
import { meAnalyticsRouter } from "./routes/me-analytics.js"
import { meImpressionsRouter } from "./routes/me-impressions.js"
import { meBalanceRouter } from "./routes/me-balance.js"
import { mePayoutsRouter } from "./routes/me-payouts.js"
import { adminReportsRouter } from "./routes/admin-reports.js"
import { miniappAuthRouter } from "./routes/miniapp-auth.js"
import { miniappWorldIdRouter } from "./routes/miniapp-world-id.js"
import { miniappGithubRouter } from "./routes/miniapp-github.js"
import { miniappSignupRouter } from "./routes/miniapp-signup.js"
import { cliPairRouter } from "./routes/cli-pair.js"
import { miniappCliLinkRouter } from "./routes/miniapp-cli-link.js"
import { testHelpersRouter } from "./routes/__test-helpers.js"
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
app.use(express.json({ limit: "1mb" }))
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

// Test-only routes — mounted ABOVE globalLimiter so the integration test
// can hit them without rate-limiting interference. Hard-gated to non-prod
// at the mount site; the route handler also short-circuits in production.
if (env.nodeEnv !== "production") {
  app.use("/__test", testHelpersRouter)
}

app.use(globalLimiter)

app.use("/auth", authRouter)
app.use("/miniapp/wallet-auth", miniappAuthRouter)
app.use("/miniapp/world-id", miniappWorldIdRouter)
app.use("/miniapp/github-oauth", miniappGithubRouter)
app.use("/miniapp/signup", miniappSignupRouter)
app.use("/cli/pair", cliPairRouter)
app.use("/miniapp/cli-link", miniappCliLinkRouter)
app.use("/devices", requireAuth, devicesRouter)
app.use("/advertisers", requireAdmin, adminLimiter, advertisersRouter)
app.use("/campaigns", requireAdmin, adminLimiter, campaignsRouter)
app.use("/admin/stats", requireAdmin, adminLimiter, adminStatsRouter)
app.use("/admin/users", requireAdmin, adminLimiter, adminUsersRouter)
app.use("/admin/payouts", requireAdmin, adminLimiter, adminPayoutsRouter)
app.use("/invites", requireAdmin, adminLimiter, invitesRouter)
app.use("/ads", requireAuth, userLimiter, adsRouter)
app.use("/ingest", requireAuth, ingestRouter)

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

app.use("/me", requireAuth, userLimiter, mePreferencesRouter)
app.use("/me/earnings", requireAuth, userLimiter, meEarningsRouter)
app.use("/me/analytics", requireAuth, userLimiter, meAnalyticsRouter)
app.use("/me/impressions", requireAuth, userLimiter, meImpressionsRouter)
app.use("/me/balance", requireAuth, userLimiter, meBalanceRouter)
app.use("/me/payouts", requireAuth, userLimiter, mePayoutsRouter)
app.use("/admin/reports", requireAdmin, adminLimiter, adminReportsRouter)

app.use(errorHandler)
