import { Router } from "express"
import { randomBytes, randomUUID } from "node:crypto"
import { eq, and, isNull } from "drizzle-orm"
import { env } from "../config/env.js"
import { logger } from "../lib/logger.js"
import { getDb } from "../db/index.js"
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

// one-time code store for secure token delivery (60s TTL)
// TODO: replace with Redis when scaling to multiple instances
interface PendingTokens {
  accessToken: string
  refreshToken: string
}
const pendingCodes = new Map<string, PendingTokens>()

import { authLimiter, refreshLimiter } from "../middleware/rate-limit.js"

export const authRouter: ReturnType<typeof Router> = Router()

// ── GET /auth/github/redirect ───────────────────────────────────────────────
authRouter.get("/github/redirect", authLimiter, async (_req, res) => {
  const state = randomBytes(16).toString("hex")
  const params = new URLSearchParams({
    client_id: env.githubClientId,
    redirect_uri: env.githubCallbackUrl,
    scope: "read:user user:email",
    state,
  })

  res.cookie("gh_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600_000,
    secure: env.nodeEnv === "production",
  })

  await res.redirect(`https://github.com/login/oauth/authorize?${params}`)
})

// ── GET /auth/github/callback ───────────────────────────────────────────────
authRouter.get("/github/callback", authLimiter, async (req, res) => {
  const { code, state } = req.query
  const cookieState = req.cookies["gh_oauth_state"] as string | undefined

  if (!state || !cookieState || state !== cookieState) {
    await res.redirect(`${env.clientRedirectUrl}?error=invalid_state`)
    return
  }
  res.clearCookie("gh_oauth_state")

  if (!code || typeof code !== "string") {
    await res.redirect(`${env.clientRedirectUrl}?error=missing_code`)
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
      await res.redirect(`${env.clientRedirectUrl}?error=user_creation_failed`)
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

    // store tokens behind a one-time code — never expose tokens in URLs
    const exchangeCode = randomBytes(16).toString("hex")
    pendingCodes.set(exchangeCode, { accessToken, refreshToken: rawRefresh })
    setTimeout(() => pendingCodes.delete(exchangeCode), 60_000)

    const redirectUrl = new URL(env.clientRedirectUrl)
    redirectUrl.searchParams.set("code", exchangeCode)
    await res.redirect(redirectUrl.toString())
  } catch (err) {
    logger.error({ err }, "oauth callback error")
    await res.redirect(`${env.clientRedirectUrl}?error=auth_failed`)
  }
})

// ── POST /auth/exchange ─────────────────────────────────────────────────────
authRouter.post("/exchange", authLimiter, async (req, res) => {
  const { code } = req.body as { code?: string }
  if (!code) {
    await res.status(400).json({ error: "missing_code" })
    return
  }

  const tokens = pendingCodes.get(code)
  if (!tokens) {
    await res.status(401).json({ error: "invalid_or_expired_code" })
    return
  }

  pendingCodes.delete(code)
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
