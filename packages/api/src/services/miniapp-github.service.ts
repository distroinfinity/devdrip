import { randomBytes } from "node:crypto"
import { eq } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { users } from "../db/schema/users.js"
import { getRedis } from "../lib/redis.js"
import {
  exchangeCodeForToken,
  fetchGitHubUser,
  fetchPrimaryEmail,
  fetchPrimaryLanguage,
} from "../lib/github.js"
import { env } from "../config/env.js"
import { ValidationError } from "../errors/index.js"

const STATE_TTL_SECONDS = 600 // 10 min

// State key is short-lived and binds the OAuth callback back to the Mini App
// session that initiated it. Stored in Redis with the user_id; the callback
// route reads it back and applies the GitHub identity to that user.
const STATE_KEY_PREFIX = "miniapp:gh-state:"

export async function mintGithubOauthState(userId: string): Promise<string> {
  const state = randomBytes(16).toString("hex")
  await getRedis().set(`${STATE_KEY_PREFIX}${state}`, userId, { ex: STATE_TTL_SECONDS })
  return state
}

export function buildGithubAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.githubClientId,
    redirect_uri: `${env.miniAppBaseUrl}/api/miniapp/github-oauth/callback`,
    scope: "read:user user:email",
    state,
  })
  return `https://github.com/login/oauth/authorize?${params}`
}

export async function consumeGithubOauthState(state: string): Promise<string | null> {
  return await getRedis().getdel<string>(`${STATE_KEY_PREFIX}${state}`)
}

// Same shape as the existing /auth/github/callback identity-fetch path, but
// applies to a Mini App user (not a fresh GitHub-OAuth-from-scratch user).
export async function bindGithubIdentityToMiniAppUser(
  userId: string,
  ghCode: string
): Promise<void> {
  const ghToken = await exchangeCodeForToken(
    ghCode,
    env.githubClientId,
    env.githubClientSecret,
    `${env.miniAppBaseUrl}/api/miniapp/github-oauth/callback`
  )
  const ghUser = await fetchGitHubUser(ghToken)
  const lang = await fetchPrimaryLanguage(ghUser.login, ghToken).catch(() => null)
  let email = ghUser.email
  if (!email) email = await fetchPrimaryEmail(ghToken)
  if (!email) email = `${ghUser.login}@users.noreply.github.com`

  const db = getDb()

  // Conflict on github_id means another user already has this GitHub identity
  // bound — refuse to overwrite, surface as a clean error.
  const [conflict] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.githubId, ghUser.id))
    .limit(1)
  if (conflict && conflict.id !== userId) {
    throw new ValidationError("github_already_bound_to_another_user")
  }

  await db
    .update(users)
    .set({
      githubId: ghUser.id,
      githubLogin: ghUser.login,
      email,
      avatarUrl: ghUser.avatar_url,
      reposCount: ghUser.public_repos,
      primaryLanguage: lang,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
}
