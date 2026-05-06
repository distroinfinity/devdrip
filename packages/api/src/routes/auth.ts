import { Router } from "express"
import { randomBytes } from "node:crypto"
import { eq } from "drizzle-orm"
import { env } from "../config/env.js"
import { logger } from "../lib/logger.js"
import { getDb } from "../db/index.js"
import { getRedis } from "../lib/redis.js"
import { users } from "../db/schema/users.js"
import { signAccessToken } from "../lib/jwt.js"
import {
  exchangeCodeForToken,
  fetchGitHubUser,
  fetchPrimaryEmail,
  fetchPrimaryLanguage,
} from "../lib/github.js"
import { generateReferralCode } from "../lib/referral.js"
import { requireAuth } from "../middleware/auth.js"
import { authLimiter, refreshLimiter } from "../middleware/rate-limit.js"

// M2: refresh_tokens schema dropped in Batch 5 (Task 19).
// /auth/refresh and /auth/logout are stubs until M2 ships auth_tokens.

export const authRouter: ReturnType<typeof Router> = Router()

const CLI_PORT_MIN = 54321
const CLI_PORT_MAX = 54330
const STATE_TTL_SECONDS = 600

function parseCliPort(raw: unknown): number | null {
  if (typeof raw !== "string") return null
  if (!/^\d+$/.test(raw)) return null
  const n = Number(raw)
  if (n < CLI_PORT_MIN || n > CLI_PORT_MAX) return null
  return n
}

async function consumeStateContext(state: string): Promise<{ cliPort?: number } | null> {
  const ctx = await getRedis().getdel<{ cliPort?: number }>(`auth:state:${state}`)
  return ctx ?? null
}

function buildRedirectUrl(cliPort: number | undefined, params: Record<string, string>): string {
  const url = cliPort
    ? new URL(`http://localhost:${cliPort}/callback`)
    : new URL(env.clientRedirectUrl)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return url.toString()
}

// ── GET /auth/github/redirect ───────────────────────────────────────────────
authRouter.get("/github/redirect", authLimiter, async (req, res) => {
  const state = randomBytes(16).toString("hex")
  const cliPort = parseCliPort(req.query["cli_port"])

  if (cliPort !== null) {
    await getRedis().set(`auth:state:${state}`, JSON.stringify({ cliPort }), {
      ex: STATE_TTL_SECONDS,
    })
  }

  const params = new URLSearchParams({
    client_id: env.githubClientId,
    redirect_uri: env.githubCallbackUrl,
    scope: "read:user user:email",
    state,
  })

  res.cookie("gh_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: STATE_TTL_SECONDS * 1000,
    secure: env.nodeEnv === "production",
  })

  await res.redirect(`https://github.com/login/oauth/authorize?${params}`)
})

// ── GET /auth/github/callback ───────────────────────────────────────────────
// M2: refresh token issuance removed; callback now stores only access token behind exchange code.
authRouter.get("/github/callback", authLimiter, async (req, res) => {
  const { code, state, error: ghError } = req.query
  const cookieState = req.cookies["gh_oauth_state"] as string | undefined

  if (!state || typeof state !== "string" || !cookieState || state !== cookieState) {
    await res.redirect(`${env.clientRedirectUrl}?error=invalid_state`)
    return
  }
  res.clearCookie("gh_oauth_state")

  const ctx = await consumeStateContext(state)
  const cliPort = ctx?.cliPort

  if (typeof ghError === "string" && ghError) {
    await res.redirect(buildRedirectUrl(cliPort, { error: ghError }))
    return
  }

  if (!code || typeof code !== "string") {
    await res.redirect(buildRedirectUrl(cliPort, { error: "missing_code" }))
    return
  }

  try {
    const ghToken = await exchangeCodeForToken(
      code,
      env.githubClientId,
      env.githubClientSecret,
      env.githubCallbackUrl
    )

    const ghUser = await fetchGitHubUser(ghToken)
    const lang = await fetchPrimaryLanguage(ghUser.login, ghToken).catch(() => null)

    let email = ghUser.email
    if (!email) {
      email = await fetchPrimaryEmail(ghToken)
    }
    if (!email) {
      email = `${ghUser.login}@users.noreply.github.com`
    }

    const db = getDb()

    const [user] = await db
      .insert(users)
      .values({
        githubId: ghUser.id,
        githubLogin: ghUser.login,
        email,
        avatarUrl: ghUser.avatar_url,
        reposCount: ghUser.public_repos,
        primaryLanguage: lang,
        referralCode: generateReferralCode(),
      })
      .onConflictDoUpdate({
        target: users.githubId,
        set: {
          githubLogin: ghUser.login,
          email,
          avatarUrl: ghUser.avatar_url,
          reposCount: ghUser.public_repos,
          primaryLanguage: lang,
          updatedAt: new Date(),
        },
      })
      .returning()

    if (!user) {
      await res.redirect(buildRedirectUrl(cliPort, { error: "user_creation_failed" }))
      return
    }

    const accessToken = await signAccessToken(
      { sub: user.id, github_login: ghUser.login },
      env.jwtSecret
    )

    // M2: refresh token issuance removed (refresh_tokens table dropped).
    // store access token behind a one-time code in Redis (60s TTL)
    const exchangeCode = randomBytes(16).toString("hex")
    await getRedis().set(
      `auth:code:${exchangeCode}`,
      JSON.stringify({ accessToken, refreshToken: null }),
      { ex: 60 }
    )

    await res.redirect(buildRedirectUrl(cliPort, { code: exchangeCode }))
  } catch (err) {
    logger.error({ err }, "oauth callback error")
    await res.redirect(buildRedirectUrl(cliPort, { error: "auth_failed" }))
  }
})

// ── POST /auth/exchange ─────────────────────────────────────────────────────
authRouter.post("/exchange", authLimiter, async (req, res) => {
  const { code } = req.body as { code?: string }
  if (!code) {
    await res.status(400).json({ error: "missing_code" })
    return
  }

  const key = `auth:code:${code}`
  const tokens = await getRedis().getdel<{ accessToken: string; refreshToken: string | null }>(key)
  if (!tokens) {
    await res.status(401).json({ error: "invalid_or_expired_code" })
    return
  }
  await res.json({ token: tokens.accessToken, refresh_token: tokens.refreshToken })
})

// ── POST /auth/refresh — M2 stub ────────────────────────────────────────────
// refresh_tokens table dropped in Batch 5; M2 ships auth_tokens with full rotation.
authRouter.post("/refresh", refreshLimiter, async (_req, res) => {
  await res.status(503).json({ error: "refresh_unavailable_until_m2" })
})

// ── POST /auth/logout ───────────────────────────────────────────────────────
// M2 stub: no refresh_tokens table; best-effort — invalidation deferred to M2.
authRouter.post("/logout", requireAuth, authLimiter, async (_req, res) => {
  // M2: revoke auth_tokens rows here
  await res.json({ ok: true })
})

// ── GET /auth/me ────────────────────────────────────────────────────────────
// lightweight user lookup for CLI post-auth confirmation
authRouter.get("/me", requireAuth, async (_req, res) => {
  const userId = res.locals["userId"] as string
  const [row] = await getDb()
    .select({ id: users.id, githubLogin: users.githubLogin, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!row) {
    await res.status(404).json({ error: "user_not_found" })
    return
  }
  await res.json(row)
})
