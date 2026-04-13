interface GitHubTokenResponse {
  access_token: string
  token_type: string
  scope: string
  error?: string
  error_description?: string
}

interface GitHubUser {
  id: number
  login: string
  email: string | null
  avatar_url: string
  public_repos: number
}

interface GitHubEmail {
  email: string
  primary: boolean
  verified: boolean
}

interface GitHubRepo {
  language: string | null
}

export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<string> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!res.ok) throw new Error(`github token exchange failed: ${res.status}`)
  const data = (await res.json()) as GitHubTokenResponse
  if (data.error) throw new Error(`github oauth error: ${data.error_description ?? data.error}`)
  if (!data.access_token) throw new Error("no access_token in github response")
  return data.access_token
}

export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  })
  if (!res.ok) throw new Error(`github user fetch failed: ${res.status}`)
  return res.json() as Promise<GitHubUser>
}

export async function fetchPrimaryEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  })
  if (!res.ok) return null
  const emails = (await res.json()) as GitHubEmail[]
  const primary = emails.find((e) => e.primary && e.verified)
  return primary?.email ?? emails.find((e) => e.verified)?.email ?? null
}

export async function fetchPrimaryLanguage(
  login: string,
  accessToken: string
): Promise<string | null> {
  const res = await fetch(`https://api.github.com/users/${login}/repos?sort=pushed&per_page=10`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  })
  if (!res.ok) return null

  const repos = (await res.json()) as GitHubRepo[]
  const counts = new Map<string, number>()
  for (const repo of repos) {
    if (repo.language) {
      counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1)
    }
  }
  if (counts.size === 0) return null

  let topLang = ""
  let topCount = 0
  for (const [lang, count] of counts) {
    if (count > topCount) {
      topLang = lang
      topCount = count
    }
  }
  return topLang
}
