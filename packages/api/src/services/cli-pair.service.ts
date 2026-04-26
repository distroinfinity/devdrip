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

  // Tokens were stashed in Redis at link time. getdel makes them single-use.
  const stash = await getRedis().getdel<string>(`${TOKEN_STASH_PREFIX}${code}`)
  if (!stash) return { kind: "expired" }
  const parsed = JSON.parse(stash) as { token: string; refreshToken: string; user: PairUserPayload }
  return { kind: "linked", ...parsed }
}

// Atomic: only succeeds if pair_session is still pending and not expired.
// Returns the issued token + refresh + user payload (the long-poll route
// stashes them in Redis under the pair code; the long-poll consumes them).
export async function linkPairSession(code: string, userId: string): Promise<PairUserPayload> {
  const db = getDb()
  const now = new Date()

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

  if (!linked) throw new ApiError(410, "pair_session_unavailable")

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
  if (!user.githubLogin) {
    // Daemon doesn't read this, but signAccessToken puts it in the JWT — must
    // be present for the token to be byte-equivalent to /auth/exchange.
    throw new ApiError(400, "github_not_bound")
  }

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

  return userPayload
}
