import { Command } from "commander"
import qrcodeTerminal from "qrcode-terminal"
import { apiFetchPublic, type MeResponse, reportError, resolveApiUrl } from "../lib/api-client.js"
import { accessTokenExpiresAt, configPath, readConfig, writeConfig } from "../lib/config.js"

interface PairCreate {
  code: string
  link_url: string
  qr_payload: string
  expires_at: string
}

interface PairLinked {
  token: string
  refresh_token: string
  user: { id: string; githubLogin: string | null; email: string; avatarUrl: string | null }
}

const POLL_INTERVAL_MS = 1_000
const TOTAL_BUDGET_MS = 5 * 60 * 1000

export const loginCmd = new Command("login")
  .description("link this CLI to your Distro TV account via QR pairing")
  .option("-f, --force", "skip the re-auth confirmation prompt")
  .action(async (opts: { force?: boolean }) => {
    try {
      await runLogin(opts.force === true)
    } catch (err) {
      reportError(err)
    }
  })

export async function runLogin(force: boolean): Promise<void> {
  const existing = await readConfig()
  if (existing && !force) {
    const login = existing.user.githubLogin || existing.user.id
    console.log(`already signed in as @${login}. pass --force to re-link.`)
    return
  }

  const baseUrl = resolveApiUrl(existing)
  const pair = await apiFetchPublic<PairCreate>("/cli/pair", { method: "POST" }, baseUrl)

  console.log(`scan from World App or open: ${pair.link_url}`)
  console.log()
  qrcodeTerminal.generate(pair.qr_payload, { small: true })
  console.log()
  console.log(`pair code: ${pair.code}`)
  console.log(`expires at: ${pair.expires_at}`)
  console.log("waiting for pairing…")

  // Long-poll directly via raw fetch — `/cli/pair/:code` returns 202 while
  // pending, 200 once linked, 410 once expired. The CLI's default apiFetch
  // helpers treat non-2xx as ApiError; raw fetch lets us discriminate by
  // status code without throwing.
  const startedAt = Date.now()
  while (Date.now() - startedAt < TOTAL_BUDGET_MS) {
    const r = await fetch(`${baseUrl}/cli/pair/${pair.code}`)
    if (r.status === 410) {
      console.error("pair session expired. re-run `distro login`.")
      process.exit(1)
    }
    if (r.status === 200) {
      const linked = (await r.json()) as PairLinked
      await persistConfig(baseUrl, linked)
      const handle = linked.user.githubLogin || linked.user.email
      console.log(`✓ linked as @${handle}`)
      console.log(`  config: ${configPath()}`)
      return
    }
    // 202 (pending) or transient — sleep + retry
    await sleep(POLL_INTERVAL_MS)
  }

  console.error("login timed out after 5 minutes. re-run `distro login`.")
  process.exit(1)
}

async function persistConfig(baseUrl: string, linked: PairLinked): Promise<void> {
  // Fetch /me so we have full user fields. The pair-linked response includes
  // a user payload but /me is the source of truth (and the daemon's prefs-sync
  // hits it on every tick — verify the token works end-to-end).
  const me = await apiFetchPublic<MeResponse>(
    "/me",
    { headers: { authorization: `Bearer ${linked.token}` } },
    baseUrl
  )

  // Persist in EXACT shape the daemon's prefs-sync loop expects (gated by
  // PR2's paired-token-prefs-sync.test.ts).
  await writeConfig({
    apiUrl: baseUrl,
    auth: {
      accessToken: linked.token,
      refreshToken: linked.refresh_token,
      accessTokenExpiresAt: accessTokenExpiresAt(),
    },
    user: {
      id: me.id,
      githubLogin: me.githubLogin ?? "",
      email: me.email,
      avatarUrl: me.avatarUrl,
    },
    device: { id: null },
    cli: { binPath: "" },
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
