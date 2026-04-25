import { createInterface } from "node:readline/promises"
import { Command } from "commander"
import {
  ApiError,
  apiFetch,
  apiFetchPublic,
  type MeResponse,
  NotAuthenticatedError,
  reportError,
  resolveApiUrl,
} from "../lib/api-client.js"
import {
  accessTokenExpiresAt,
  configExists,
  configPath,
  deleteConfig,
  readConfig,
  writeConfig,
} from "../lib/config.js"
import { findFreePort, openBrowser, waitForCallback } from "../lib/auth-flow.js"

interface ExchangeResponse {
  token: string
  refresh_token: string
}

export const authCmd = new Command("auth")
  .description("authenticate with GitHub OAuth")
  .option("--logout", "sign out and clear the local session")
  .option("-f, --force", "skip the re-auth confirmation prompt")
  .action(async (opts: { logout?: boolean; force?: boolean }) => {
    try {
      if (opts.logout) {
        await runLogout()
        return
      }
      await runLogin(opts.force === true)
    } catch (err) {
      reportError(err)
    }
  })

async function runLogout(): Promise<void> {
  const cfg = await readConfig()
  if (!cfg) {
    console.log("not signed in")
    return
  }

  try {
    await apiFetch<{ ok: true }>("/auth/logout", { method: "POST" })
  } catch (err) {
    // backend rotation may already be dead — best effort, still clear local config
    if (!(err instanceof NotAuthenticatedError) && !(err instanceof ApiError)) throw err
  }

  await deleteConfig()
  console.log("✓ signed out")
}

async function runLogin(force: boolean): Promise<void> {
  const existing = await readConfig()
  if (existing && !force) {
    const login = existing.user.githubLogin ?? existing.user.id
    const proceed = await confirm(`already signed in as @${login}. re-authenticate? [y/N] `)
    if (!proceed) return
  }

  const baseUrl = resolveApiUrl(existing)
  const port = await findFreePort()
  const callback = waitForCallback({ port })

  const authUrl = `${baseUrl}/auth/github/redirect?cli_port=${port}`
  console.log(`opening browser to ${authUrl}`)
  console.log("(if your browser didn't open, paste the URL above into one manually)")
  console.log("waiting for GitHub sign-in (60s timeout)…")
  openBrowser(authUrl)

  const result = await callback
  if ("error" in result) {
    const msg = result.error === "access_denied" ? "auth cancelled" : `auth failed: ${result.error}`
    console.error(msg)
    process.exit(1)
  }

  const tokens = await apiFetchPublic<ExchangeResponse>(
    "/auth/exchange",
    { method: "POST", body: { code: result.code } },
    baseUrl
  )

  // fetch /me with the fresh token directly — don't persist a partial config
  // that would leave the CLI in a broken state if this call fails
  const me = await apiFetchPublic<MeResponse>(
    "/me",
    { headers: { authorization: `Bearer ${tokens.token}` } },
    baseUrl
  )

  await writeConfig({
    version: 1,
    apiUrl: baseUrl,
    auth: {
      accessToken: tokens.token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt: accessTokenExpiresAt(),
    },
    user: {
      id: me.id,
      githubLogin: me.githubLogin ?? "",
      email: me.email,
      avatarUrl: me.avatarUrl,
    },
  })

  const handle = me.githubLogin || me.email
  console.log(`✓ signed in as @${handle}`)
  console.log(`  config: ${configPath()}`)
}

async function confirm(prompt: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const ans = (await rl.question(prompt)).trim().toLowerCase()
    return ans === "y" || ans === "yes"
  } finally {
    rl.close()
  }
}

// re-export so status and other commands can check config presence without
// importing directly from lib/config in every command
export { configExists }
