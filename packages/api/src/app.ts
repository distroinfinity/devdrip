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
import { authMagicLinkRouter } from "./routes/auth-magic-link.js"
import { devicesPairRouter, authExchangePairRouter } from "./routes/auth-pair.js"
import { devicesRouter, devicesRegisterRouter } from "./routes/devices.js"
import { mePreferencesRouter } from "./routes/me-preferences.js"
import { meReadingRouter } from "./routes/me-reading.js"
import { meContentRouter } from "./routes/me-content.js"
import { channelsPublicRouter, meChannelsRouter } from "./routes/news-channels.js"
import { tickersRouter } from "./routes/tickers.js"
import { meWatchlistsRouter } from "./routes/me-watchlists.js"
import { meAlertsRouter } from "./routes/me-alerts.js"
import { meActivitySummaryRouter } from "./routes/me-activity-summary.js"
import { meWatchlistSparklinesRouter } from "./routes/me-watchlist-sparklines.js"
import { meNowPlayingRouter } from "./routes/me-now-playing.js"
import { meRecentNewsRouter } from "./routes/me-recent-news.js"
import { ingestRouter } from "./routes/ingest.js"
import { testHelpersRouter } from "./routes/__test-helpers.js"
import { requireAuth } from "./middleware/auth.js"
import { globalLimiter, userLimiter, authLimiter } from "./middleware/rate-limit.js"
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

app.use("/channels", channelsPublicRouter)
app.use("/tickers", tickersRouter)

app.use("/auth", authRouter)
app.use("/auth/magic-link", authLimiter, authMagicLinkRouter)
app.use("/auth/exchange-pair", globalLimiter, authExchangePairRouter)
// public — anon device registration (no auth required)
app.use("/devices/register", devicesRegisterRouter)
app.use("/devices/pair", devicesPairRouter)
// authed — list, update, delete devices
app.use("/devices", requireAuth, userLimiter, devicesRouter)

app.get("/me", requireAuth, userLimiter, async (_req, res) => {
  const userId = res.locals["userId"] as string
  const [row] = await getDb()
    .select({
      id: users.id,
      githubLogin: users.githubLogin,
      email: users.email,
      avatarUrl: users.avatarUrl,
      signedUpAt: users.signedUpAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!row) {
    await res.status(404).json({ error: "user_not_found" })
    return
  }
  await res.json({
    id: row.id,
    githubLogin: row.githubLogin,
    email: row.email,
    avatarUrl: row.avatarUrl,
    signedUpAt: row.signedUpAt?.toISOString() ?? null,
  })
})

app.use("/me", requireAuth, userLimiter, mePreferencesRouter)
app.use("/me/reading", requireAuth, userLimiter, meReadingRouter)
app.use("/me/content", requireAuth, userLimiter, meContentRouter)
app.use("/me/channels", requireAuth, userLimiter, meChannelsRouter)
app.use("/me/watchlists", requireAuth, userLimiter, meWatchlistsRouter)
app.use("/me/alerts", requireAuth, userLimiter, meAlertsRouter)
app.use("/me/activity-summary", requireAuth, userLimiter, meActivitySummaryRouter)
app.use("/me/watchlist/sparklines", requireAuth, userLimiter, meWatchlistSparklinesRouter)
app.use("/me/devices/:id/now", requireAuth, userLimiter, meNowPlayingRouter)
app.use("/me/recent-news", requireAuth, userLimiter, meRecentNewsRouter)
app.use("/ingest", requireAuth, userLimiter, ingestRouter)

app.use(errorHandler)
