import { Router } from "express"
import { randomBytes, randomUUID } from "node:crypto"
import { eq, and, isNull } from "drizzle-orm"
import { env } from "../config/env.js"
import { logger } from "../lib/logger.js"
import { getDb } from "../db/index.js"
import { getRedis } from "../lib/redis.js"
import { users } from "../db/schema/users.js"
import { refreshTokens } from "../db/schema/refresh_tokens.js"
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
} from "../lib/jwt.js"
import {
  exchangeCodeForToken,
  fetchGitHubUser,
  fetchPrimaryEmail,
  fetchPrimaryLanguage,
} from "../lib/github.js"
import { generateReferralCode } from "../lib/referral.js"
import { requireAuth } from "../middleware/auth.js"
import { authLimiter, refreshLimiter } from "../middleware/rate-limit.js"

export const authRouter: ReturnType<typeof Router> = Router()

// CLI auth flow: the `devdrip auth` command passes cli_port so the browser
// round-trip can land back on the user's machine. Port range is locked down to
// prevent open-redirect abuse.
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
  const raw = await getRedis().getdel<string>(`auth:state:${state}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as { cliPort?: number }
  } catch {
    return null
  }
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
authRouter.get("/github/callback", authLimiter, async (req, res) => {
  const { code, state, error: ghError } = req.query
  const cookieState = req.cookies["gh_oauth_state"] as string | undefined

  if (!state || typeof state !== "string" || !cookieState || state !== cookieState) {
    // state invalid → can't look up cli_port safely; fall back to web redirect
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
    const rawRefresh = generateRefreshToken()
    const family = randomUUID()

    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashRefreshToken(rawRefresh),
      family,
      expiresAt: refreshTokenExpiresAt(),
    })

    // store tokens behind a one-time code in Redis (60s TTL)
    const exchangeCode = randomBytes(16).toString("hex")
    await getRedis().set(
      `auth:code:${exchangeCode}`,
      JSON.stringify({ accessToken, refreshToken: rawRefresh }),
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
  const raw = await getRedis().getdel<string>(key)
  if (!raw) {
    await res.status(401).json({ error: "invalid_or_expired_code" })
    return
  }

  let tokens: { accessToken: string; refreshToken: string }
  try {
    tokens = JSON.parse(raw) as { accessToken: string; refreshToken: string }
  } catch (err) {
    logger.error({ err }, "malformed exchange payload in redis")
    await res.status(500).json({ error: "internal_error" })
    return
  }
  await res.json({ token: tokens.accessToken, refresh_token: tokens.refreshToken })
})

// ── POST /auth/refresh ──────────────────────────────────────────────────────
authRouter.post("/refresh", refreshLimiter, async (req, res) => {
  const { refresh_token } = req.body as { refresh_token?: string }
  if (!refresh_token) {
    await res.status(401).json({ error: "missing_refresh_token" })
    return
  }

  const db = getDb()
  const hash = hashRefreshToken(refresh_token)

  // atomic revoke — only one concurrent request can succeed
  const [revoked] = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, hash), isNull(refreshTokens.revokedAt)))
    .returning()

  if (!revoked) {
    // distinguish "not found" from "already revoked" (theft detection)
    const [stale] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hash))
      .limit(1)

    if (stale) {
      // token exists but was already revoked → theft detected, revoke entire family
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.family, stale.family), isNull(refreshTokens.revokedAt)))
      await res.status(401).json({ error: "refresh_token_reuse_detected" })
      return
    }

    await res.status(401).json({ error: "invalid_refresh_token" })
    return
  }

  if (revoked.expiresAt < new Date()) {
    await res.status(401).json({ error: "refresh_token_expired" })
    return
  }

  // TODO: make revoke/reuse-detection/rotation fully transactional so a concurrent
  // family revoke cannot race with successor insertion and leave a live descendant.
  // issue new token in same family
  const newRaw = generateRefreshToken()
  const newHash = hashRefreshToken(newRaw)

  await db.insert(refreshTokens).values({
    userId: revoked.userId,
    tokenHash: newHash,
    family: revoked.family,
    expiresAt: refreshTokenExpiresAt(),
  })

  const [user] = await db.select().from(users).where(eq(users.id, revoked.userId)).limit(1)

  if (!user?.githubLogin) {
    await res.status(500).json({ error: "internal_error" })
    return
  }

  const accessToken = await signAccessToken(
    { sub: user.id, github_login: user.githubLogin },
    env.jwtSecret
  )

  await res.json({ token: accessToken, refresh_token: newRaw })
})

// ── POST /auth/logout ───────────────────────────────────────────────────────
authRouter.post("/logout", requireAuth, authLimiter, async (_req, res) => {
  const userId = res.locals["userId"] as string
  const db = getDb()

  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))

  await res.json({ ok: true })
})
