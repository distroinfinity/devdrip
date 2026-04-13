import { Router } from "express"
import { randomBytes, randomUUID } from "node:crypto"
import { eq, and, isNull } from "drizzle-orm"
import { env } from "../config/env.js"
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

export const authRouter: ReturnType<typeof Router> = Router()

// ── GET /auth/github/redirect ───────────────────────────────────────────────
authRouter.get("/github/redirect", async (_req, res) => {
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
authRouter.get("/github/callback", async (req, res) => {
  const { code, state } = req.query
  const cookieState = (req as unknown as { cookies: Record<string, string> }).cookies?.[
    "gh_oauth_state"
  ]

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

    const redirectUrl = new URL(env.clientRedirectUrl)
    redirectUrl.searchParams.set("token", accessToken)
    redirectUrl.searchParams.set("refresh_token", rawRefresh)
    await res.redirect(redirectUrl.toString())
  } catch (err) {
    console.error("oauth callback error:", err)
    await res.redirect(`${env.clientRedirectUrl}?error=auth_failed`)
  }
})

// ── POST /auth/refresh ──────────────────────────────────────────────────────
authRouter.post("/refresh", async (req, res) => {
  const { refresh_token } = req.body as { refresh_token?: string }
  if (!refresh_token) {
    await res.status(401).json({ error: "missing_refresh_token" })
    return
  }

  const db = getDb()
  const hash = hashRefreshToken(refresh_token)

  const [existing] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hash))
    .limit(1)

  if (!existing) {
    await res.status(401).json({ error: "invalid_refresh_token" })
    return
  }

  // theft detection: revoked token reused → revoke entire family
  if (existing.revokedAt !== null) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.family, existing.family), isNull(refreshTokens.revokedAt)))
    await res.status(401).json({ error: "refresh_token_reuse_detected" })
    return
  }

  if (existing.expiresAt < new Date()) {
    await res.status(401).json({ error: "refresh_token_expired" })
    return
  }

  // rotate: revoke old + issue new in transaction
  const newRaw = generateRefreshToken()
  const newHash = hashRefreshToken(newRaw)

  await db.transaction(async (tx) => {
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, existing.id))

    await tx.insert(refreshTokens).values({
      userId: existing.userId,
      tokenHash: newHash,
      family: existing.family,
      expiresAt: refreshTokenExpiresAt(),
    })
  })

  const [user] = await db.select().from(users).where(eq(users.id, existing.userId)).limit(1)

  if (!user) {
    await res.status(401).json({ error: "user_not_found" })
    return
  }

  const accessToken = await signAccessToken(
    { sub: user.id, github_login: user.githubLogin ?? "" },
    env.jwtSecret
  )

  await res.json({ token: accessToken, refresh_token: newRaw })
})
