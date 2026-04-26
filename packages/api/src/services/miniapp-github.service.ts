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
const RESUME_TTL_SECONDS = 120 // 2 min — must outlive the user tap-back delay
const RESUME_KEY_PREFIX = "miniapp:resume:"

// State key is short-lived and binds the OAuth callback back to the Mini App
// session that initiated it. Stored in Redis with both the user_id and any
// CLI-link code that came in via /m/signup?link=… — we need to preserve the
// link code through the OAuth round-trip so the post-callback redirect can
// route the user back to the LinkCliCard.
const STATE_KEY_PREFIX = "miniapp:gh-state:"

export interface GithubOauthState {
  userId: string
  linkCode?: string
}

export async function mintGithubOauthState(state: GithubOauthState): Promise<string> {
  const token = randomBytes(16).toString("hex")
  await getRedis().set(`${STATE_KEY_PREFIX}${token}`, JSON.stringify(state), {
    ex: STATE_TTL_SECONDS,
  })
  return token
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

// Cross-context session resume.
//
// iOS opens GitHub OAuth in a separate browser (Safari / SFSafariViewController
// or a fresh WebView). The post-callback redirect lands in that other context,
// not in World App's WebView. Cookies are isolated per WebView — we can't set
// dd_miniapp on the callback response and expect World App's WebView to read it.
//
// Workaround: mint a single-use resume code on the callback, embed it in the
// world.org/mini-app deeplink, and have the Mini App page POST it to
// /miniapp/signup-resume to swap the code for a fresh dd_miniapp cookie inside
// World App's WebView.
export interface ResumeData {
  userId: string
  linkCode?: string
}

export async function mintResumeCode(data: ResumeData): Promise<string> {
  const code = randomBytes(16).toString("hex")
  await getRedis().set(`${RESUME_KEY_PREFIX}${code}`, JSON.stringify(data), {
    ex: RESUME_TTL_SECONDS,
  })
  return code
}

export async function consumeResumeCode(code: string): Promise<ResumeData | null> {
  const raw = await getRedis().getdel<string>(`${RESUME_KEY_PREFIX}${code}`)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ResumeData
    if (typeof parsed === "object" && parsed && typeof parsed.userId === "string") return parsed
  } catch {
    // not JSON
  }
  return null
}

export async function consumeGithubOauthState(state: string): Promise<GithubOauthState | null> {
  const raw = await getRedis().getdel<string>(`${STATE_KEY_PREFIX}${state}`)
  if (!raw) return null
  // Backward-compat: older entries stored just the userId as a plain string.
  // New entries store JSON. Try JSON first; fall back to treating the raw
  // value as a userId.
  try {
    const parsed = JSON.parse(raw) as GithubOauthState
    if (typeof parsed === "object" && parsed && typeof parsed.userId === "string") return parsed
  } catch {
    // not JSON — fall through
  }
  return { userId: raw }
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
