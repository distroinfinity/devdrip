import { env } from "../config/env.js"
import { logger } from "../lib/logger.js"

const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
const GITHUB_USER_URL = "https://api.github.com/user"
const GITHUB_EMAILS_URL = "https://api.github.com/user/emails"
const FETCH_TIMEOUT_MS = 10_000

export interface GitHubProfile {
  githubId: number
  login: string
  email: string
  avatarUrl: string
}

export class GitHubOAuthError extends Error {
  constructor(
    public code: string,
    public httpStatus: number
  ) {
    super(code)
  }
}

export async function exchangeCodeForProfile(ghCode: string): Promise<GitHubProfile> {
  const accessToken = await exchangeCode(ghCode)
  const [profile, primaryEmail] = await Promise.all([
    fetchProfile(accessToken),
    fetchPrimaryVerifiedEmail(accessToken),
  ])
  const email = profile.email ?? primaryEmail
  if (!email) throw new GitHubOAuthError("no_verified_email", 400)
  return {
    githubId: profile.id,
    login: profile.login,
    email,
    avatarUrl: profile.avatar_url,
  }
}

async function exchangeCode(ghCode: string): Promise<string> {
  const resp = await fetchWithTimeout(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.githubOAuthClientId,
      client_secret: env.githubOAuthClientSecret,
      code: ghCode,
      redirect_uri: env.githubOAuthRedirectUri,
    }),
  })
  if (resp.status === 429) throw new GitHubOAuthError("github_rate_limited", 502)
  if (!resp.ok) {
    logger.error({ status: resp.status }, "github token exchange failed")
    throw new GitHubOAuthError("github_unavailable", 502)
  }
  const data = (await resp.json()) as { access_token?: string; error?: string }
  if (data.error || !data.access_token) {
    throw new GitHubOAuthError("github_unavailable", 502)
  }
  return data.access_token
}

interface GitHubUserResponse {
  id: number
  login: string
  email: string | null
  avatar_url: string
}

async function fetchProfile(accessToken: string): Promise<GitHubUserResponse> {
  const resp = await fetchWithTimeout(GITHUB_USER_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "distrotv-api",
    },
  })
  if (resp.status === 429) throw new GitHubOAuthError("github_rate_limited", 502)
  if (!resp.ok) throw new GitHubOAuthError("github_unavailable", 502)
  return (await resp.json()) as GitHubUserResponse
}

interface GitHubEmail {
  email: string
  primary: boolean
  verified: boolean
}

async function fetchPrimaryVerifiedEmail(accessToken: string): Promise<string | null> {
  const resp = await fetchWithTimeout(GITHUB_EMAILS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "distrotv-api",
    },
  })
  if (resp.status === 429) throw new GitHubOAuthError("github_rate_limited", 502)
  if (!resp.ok) return null
  const emails = (await resp.json()) as GitHubEmail[]
  const primary = emails.find((e) => e.primary && e.verified)
  if (primary) return primary.email
  const anyVerified = emails.find((e) => e.verified)
  return anyVerified?.email ?? null
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new GitHubOAuthError("github_unavailable", 502)
    }
    throw err
  } finally {
    clearTimeout(t)
  }
}
