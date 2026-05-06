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
import { devicesRouter, devicesRegisterRouter } from "./routes/devices.js"
import { mePreferencesRouter } from "./routes/me-preferences.js"
import { meReadingRouter } from "./routes/me-reading.js"
import { meContentRouter } from "./routes/me-content.js"
import { ingestRouter } from "./routes/ingest.js"
import { testHelpersRouter } from "./routes/__test-helpers.js"
import { requireAuth } from "./middleware/auth.js"
import { globalLimiter, userLimiter } from "./middleware/rate-limit.js"
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
// M2: re-mount /cli/pair when magic-link pairing flow is rebuilt
// app.use("/cli/pair", cliPairRouter)
// public — anon device registration (no auth required)
app.use("/devices/register", devicesRegisterRouter)
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
app.use("/ingest", requireAuth, userLimiter, ingestRouter)

app.use(errorHandler)
