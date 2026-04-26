import { randomUUID } from "node:crypto"
import { and, eq, sql } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { getRedis } from "../lib/redis.js"
import { cliPairSessions } from "../db/schema/cli_pair_sessions.js"
import { users } from "../db/schema/users.js"
import { refreshTokens } from "../db/schema/refresh_tokens.js"
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
} from "../lib/jwt.js"
import { generatePairCode } from "../lib/crockford.js"
import { env } from "../config/env.js"
import { ApiError } from "../errors/index.js"

const PAIR_TTL_SECONDS = 5 * 60 // 5 min
const TOKEN_STASH_PREFIX = "cli:pair:tokens:"
const TOKEN_STASH_TTL_SECONDS = 5 * 60 // 5 min

export interface CreatedPairSession {
  code: string
  linkUrl: string
  qrPayload: string
  expiresAt: Date
}

export async function createPairSession(): Promise<CreatedPairSession> {
  const code = generatePairCode()
  const expiresAt = new Date(Date.now() + PAIR_TTL_SECONDS * 1000)
  const db = getDb()
  await db.insert(cliPairSessions).values({
    code,
    status: "pending",
    expiresAt,
  })
  // Mini App opens via World App: world.org/mini-app deep-link with our app_id
  // and an internal path that includes the link code. Frontend's /m/signup page
  // reads the ?link= query param and routes through cli-link/:code.
  const linkUrl = `https://world.org/mini-app?app_id=${env.worldAppId}&path=${encodeURIComponent(`/m/signup?link=${code}`)}`
  return { code, linkUrl, qrPayload: linkUrl, expiresAt }
}

export type PairFetchResult =
  | { kind: "pending" }
  | { kind: "expired" }
  | { kind: "linked"; token: string; refreshToken: string; user: PairUserPayload }

export interface PairUserPayload {
  id: string
  githubLogin: string | null
  email: string
  avatarUrl: string | null
}

export async function fetchPairTokens(code: string): Promise<PairFetchResult> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(cliPairSessions)
    .where(eq(cliPairSessions.code, code))
    .limit(1)

  if (!row) return { kind: "expired" }
  if (row.expiresAt < new Date()) return { kind: "expired" }
  if (row.status !== "linked") return { kind: "pending" }

  // Happy path: stash exists from linkPairSession. getdel makes it single-use.
  const stash = await getRedis().getdel<string>(`${TOKEN_STASH_PREFIX}${code}`)
  if (stash) {
    const parsed = JSON.parse(stash) as {
      token: string
      refreshToken: string
      user: PairUserPayload
    }
    return { kind: "linked", ...parsed }
  }

  // Recovery path: stash missing (Redis eviction, partial link). The row's
  // userId is the source of truth for who owns this pairing — mint a fresh
  // pair from it. This keeps the user from being stuck on a permanently
  // 'linked' row that can never deliver tokens.
  if (!row.userId) return { kind: "expired" }
  const [user] = await db
    .select({
      id: users.id,
      githubLogin: users.githubLogin,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1)
  if (!user || !user.githubLogin) return { kind: "expired" }

  const accessToken = await signAccessToken(
    { sub: user.id, github_login: user.githubLogin },
    env.jwtSecret
  )
  const rawRefresh = generateRefreshToken()
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashRefreshToken(rawRefresh),
    family: randomUUID(),
    expiresAt: refreshTokenExpiresAt(),
  })

  return {
    kind: "linked",
    token: accessToken,
    refreshToken: rawRefresh,
    user: {
      id: user.id,
      githubLogin: user.githubLogin,
      email: user.email,
      avatarUrl: user.avatarUrl,
    },
  }
}

// Mint tokens + stash BEFORE flipping pair_session status. If anything fails
// before the status flip the row stays 'pending' and the user can retry. We
// leak at most one refresh_token row per failed attempt. The status flip is
// an atomic conditional update; if a concurrent caller wins the race we
// clean up our stash and return 410.
export async function linkPairSession(code: string, userId: string): Promise<PairUserPayload> {
  const db = getDb()
  const now = new Date()

  // 1. Validate the session is still claimable. Read-only — we don't mutate
  //    state until we've staged tokens.
  const [session] = await db
    .select()
    .from(cliPairSessions)
    .where(eq(cliPairSessions.code, code))
    .limit(1)
  if (!session || session.status !== "pending" || session.expiresAt < now) {
    throw new ApiError(410, "pair_session_unavailable")
  }

  // 2. Look up the user. Daemon-compat requires github_login in the JWT.
  const [user] = await db
    .select({
      id: users.id,
      githubLogin: users.githubLogin,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!user) throw new ApiError(500, "user_lookup_failed_after_link")
  if (!user.githubLogin) throw new ApiError(400, "github_not_bound")

  // 3-5. Mint tokens, insert refresh row, stash in Redis — all BEFORE flipping
  //      session status.
  const accessToken = await signAccessToken(
    { sub: user.id, github_login: user.githubLogin },
    env.jwtSecret
  )
  const rawRefresh = generateRefreshToken()
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashRefreshToken(rawRefresh),
    family: randomUUID(),
    expiresAt: refreshTokenExpiresAt(),
  })

  const userPayload: PairUserPayload = {
    id: user.id,
    githubLogin: user.githubLogin,
    email: user.email,
    avatarUrl: user.avatarUrl,
  }

  await getRedis().set(
    `${TOKEN_STASH_PREFIX}${code}`,
    JSON.stringify({ token: accessToken, refreshToken: rawRefresh, user: userPayload }),
    { ex: TOKEN_STASH_TTL_SECONDS }
  )

  // 6. Atomic status flip — only succeeds if still pending and not expired.
  const [linked] = await db
    .update(cliPairSessions)
    .set({ userId, status: "linked", completedAt: now })
    .where(
      and(
        eq(cliPairSessions.code, code),
        eq(cliPairSessions.status, "pending"),
        sql`${cliPairSessions.expiresAt} > ${now.toISOString()}`
      )
    )
    .returning()

  // 7. Race lost — another link request flipped the row first. Clean up our
  //    stash so the winner's tokens (which they staged in their own call)
  //    aren't accidentally consumed by us. Refresh_tokens leaks one row.
  if (!linked) {
    await getRedis().del(`${TOKEN_STASH_PREFIX}${code}`)
    throw new ApiError(410, "pair_session_unavailable")
  }

  return userPayload
}
