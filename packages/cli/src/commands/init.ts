import { mkdir } from "node:fs/promises"
import { spawn } from "node:child_process"
import { homedir } from "node:os"
import { lstatSync, mkdirSync, realpathSync, statSync, symlinkSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import { Command } from "commander"
import { intro, outro, log, note, spinner } from "@clack/prompts"
import { ChannelMode } from "@distrotv/shared"
import {
  ApiError,
  NotAuthenticatedError,
  pairInit,
  pairPoll,
  reportError,
  resolveApiUrl,
  type PairPollResult,
  type MeResponse,
} from "../lib/api-client.js"
import { readConfig, writeConfig } from "../lib/config.js"
import { defaultDevdripPreferences } from "@distrotv/shared"
import {
  readSettings,
  writeSettingsAtomic,
  writeBackupOnce,
  mergeDevdripHooks,
} from "../lib/claude-settings.js"
import { putPreferences } from "../lib/preferences-client.js"
import { getMyChannels, putMyChannels } from "../lib/channels-client.js"
import { getMyWatchlists, putMyWatchlists } from "../lib/watchlists-client.js"
import { pickChannelMode } from "../lib/prompts/preferences.js"
import { pickChannels } from "../lib/prompts/channels.js"
import { pickWatchlistTickers } from "../lib/prompts/watchlist.js"
import { runInitHealthCheck } from "../lib/health.js"
import { runDemo } from "./demo.js"
import { validateDeviceToken } from "../lib/device.js"

function claudeDir(): string {
  return join(homedir(), ".claude")
}

function claudeSettingsPath(): string {
  return join(claudeDir(), "settings.json")
}

function claudeBackupPath(): string {
  return `${claudeSettingsPath()}.distro-backup`
}

function distroBinLinkPath(): string {
  return join(homedir(), ".distro", "bin", "distro")
}

function dtvBinLinkPath(): string {
  return join(homedir(), ".distro", "bin", "dtv")
}

function tryUnlink(p: string): void {
  try {
    lstatSync(p)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return
    throw err
  }
  unlinkSync(p)
}

// returns a stable user-scoped path (~/.distro/bin/distro) that symlinks to
// the currently running binary. writing this into settings.json hooks means a
// worktree deletion can be recovered by re-running `distro init` from any
// working build — the symlink retargets, the hook entries never change.
function resolveBinPath(): string {
  const arg = process.argv[1]
  if (!arg) return ""

  let source: string
  try {
    if (!statSync(arg).isFile()) return arg
    source = realpathSync(arg)
  } catch {
    return arg
  }

  const linkPath = distroBinLinkPath()
  const dtvPath = dtvBinLinkPath()
  try {
    mkdirSync(join(linkPath, ".."), { recursive: true, mode: 0o700 })
    tryUnlink(linkPath)
    symlinkSync(source, linkPath)
    tryUnlink(dtvPath)
    symlinkSync(source, dtvPath)
    return linkPath
  } catch {
    log.warn(`could not install ${linkPath} symlink — using direct binary path`)
    return source
  }
}

async function ensureClaudeDir(): Promise<void> {
  try {
    await mkdir(claudeDir(), { recursive: true, mode: 0o700 })
    log.success(`Claude settings dir ready (${claudeDir()})`)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`failed to prepare ${claudeDir()}: ${detail}`)
  }
}

async function ensureSignedInOrPair(): Promise<{ user: MeResponse }> {
  const cfg = await readConfig()

  // 1) Try existing device token if present.
  if (cfg?.device.secret) {
    const me = await validateDeviceToken()
    if (me) {
      log.success(`signed in as @${me.githubLogin ?? me.id}`)
      return { user: me }
    }
    log.info("existing device token is invalid — re-running sign-in")
  }

  // 2) Fresh OAuth pair flow.
  const init = await pairInit()
  log.success(`pair code requested: ${init.code.slice(0, 8)}…`)

  await openOrPrintSetup(init.setupUrl, init.code)

  const ready = await waitForPair(init.code, init.expiresInSec)
  if (ready.kind !== "ready") {
    throw new Error(
      "sign-in took too long or was cancelled — re-run `distro init` when you're ready"
    )
  }

  await writeConfig({
    apiUrl: resolveApiUrl(null),
    auth: null,
    user: {
      id: ready.user.id,
      githubLogin: ready.user.githubLogin,
      email: ready.user.email,
      avatarUrl: ready.user.avatarUrl,
    },
    device: { id: ready.deviceId, secret: ready.deviceToken.replace(/^device\./, "") },
    cli: { binPath: "" },
    preferences: defaultDevdripPreferences(),
  })
  log.success(`signed in as @${ready.user.githubLogin}`)
  return { user: ready.user }
}

async function openOrPrintSetup(setupUrl: string, code: string): Promise<void> {
  const noBrowser = process.argv.includes("--no-browser")
  if (!noBrowser) {
    try {
      await openUrl(setupUrl)
      log.success(`browser opened: ${setupUrl}`)
      return
    } catch {
      log.warn("could not open browser automatically")
    }
  }
  note(
    [
      "open this URL on any device to finish sign-in:",
      "",
      `  ${setupUrl}`,
      "",
      `pair code: ${code}`,
    ].join("\n"),
    "manual sign-in"
  )
}

async function waitForPair(code: string, ttlSec: number): Promise<PairPollResult> {
  const deadline = Date.now() + ttlSec * 1000
  const s = spinner()
  s.start("waiting for GitHub sign-in… (Ctrl-C to cancel)")
  try {
    while (Date.now() < deadline) {
      const result = await pairPoll(code)
      if (result.kind === "ready") {
        s.stop("sign-in complete")
        return result
      }
      if (result.kind === "expired") {
        s.stop("pair code expired")
        return result
      }
      // pending — the long-poll already waited ~25s; immediately re-poll
    }
    s.stop("sign-in timed out")
    return { kind: "expired" }
  } catch (err) {
    s.stop("sign-in failed")
    throw err
  }
}

async function savePreferences(channelMode: ChannelMode): Promise<void> {
  const tzOffsetMinutes = -new Date().getTimezoneOffset()
  const updated = await putPreferences({ tzOffsetMinutes, channelMode })
  // mirror to local config so daemon/demo/preferences see the new mode without
  // waiting on the next prefs-sync tick
  const cfg = await readConfig()
  if (cfg) {
    await writeConfig({
      apiUrl: cfg.apiUrl,
      auth: cfg.auth,
      user: cfg.user,
      device: cfg.device,
      cli: cfg.cli,
      preferences: { ...cfg.preferences, ...updated },
    })
  }
  log.success(`preferences saved (mode: ${channelMode})`)
}

async function installHooks(): Promise<void> {
  const settingsPath = claudeSettingsPath()
  const backupPath = claudeBackupPath()
  const binPath = resolveBinPath()
  if (!binPath.trim()) {
    throw new Error("unable to resolve the distro binary path for Claude hooks")
  }

  await writeBackupOnce(settingsPath, backupPath)

  const existing = await readSettings(settingsPath)
  const { next, changed } = mergeDevdripHooks(existing, binPath)

  // always keep cfg.cli.binPath current — even if settings.json is already correct
  const cfg = await readConfig()
  if (cfg && cfg.cli?.binPath !== binPath) {
    await writeConfig({
      apiUrl: cfg.apiUrl,
      auth: cfg.auth,
      user: cfg.user,
      device: cfg.device,
      cli: { binPath },
      preferences: cfg.preferences,
    })
  }

  if (!changed) {
    log.success(`hooks already installed`)
    return
  }
  await writeSettingsAtomic(settingsPath, next)
  log.success(`hooks installed in ${settingsPath}`)
}

async function previewSlot(): Promise<void> {
  log.step("previewing first slot")
  try {
    await runDemo()
  } catch (err) {
    if (err instanceof ApiError || err instanceof NotAuthenticatedError) {
      log.warn("preview unavailable — run `distro demo` after your next Claude session")
      return
    }
    if (err instanceof Error && err.message === "device not registered — run `distro init`") {
      log.warn("preview unavailable — run `distro demo` after your next Claude session")
      return
    }
    if (err instanceof TypeError && /fetch/i.test(err.message)) {
      log.warn("preview unavailable — run `distro demo` after your next Claude session")
      return
    }
    throw err
  }
}

async function runHealthCheck(): Promise<boolean> {
  const cfg = await readConfig()
  if (!cfg) return false
  const probes = await runInitHealthCheck(cfg, claudeSettingsPath())
  const lines = probes
    .map((p) => {
      const mark = p.ok ? "✓" : "✗"
      const detail = p.detail ? `  ${p.detail}` : ""
      return `${mark}  ${p.name}${detail}`
    })
    .join("\n")
  note(lines, "health check")
  return probes.every((p) => p.ok)
}

async function openUrl(url: string): Promise<void> {
  if (process.platform === "win32") {
    // `start` is a shell builtin on Windows — must go through cmd.
    // empty quoted "" is the window title arg (start uses first quoted arg as title).
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref()
    return
  }
  const cmd = process.platform === "darwin" ? "open" : "xdg-open"
  spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref()
}

function printSummary(): void {
  note(
    [
      "→ run `distro status` to see daemon + slot status",
      "→ start coding in Claude Code; first slot appears in ~5s",
      "→ visit your dashboard at https://distrotv.xyz/dashboard",
    ].join("\n"),
    "what's next"
  )
}

// Without an active daemon, hook events fire into a dead socket and ads never
// render. init now starts the daemon explicitly so a fresh user can open
// Claude Code and immediately see ads with no extra step. Wrapped in a broad
// catch because runStart spawns a child process — in CI/test environments the
// fake binary path may not be executable (EACCES), and we never want a init
// failure here to abort the whole onboarding.
async function ensureDaemonRunning(): Promise<void> {
  try {
    const { runStart } = await import("./daemon.js")
    const code = await runStart()
    if (code !== 0) {
      log.warn("daemon failed to start — run `distro daemon start` manually")
    } else {
      log.success("daemon started")
    }
  } catch (err) {
    log.warn(
      `daemon start skipped (${err instanceof Error ? err.message : String(err)}) — run \`distro daemon start\` manually`
    )
  }
}

export async function runInit(): Promise<void> {
  intro("distro init — let's get you set up")

  await ensureClaudeDir()
  await ensureSignedInOrPair()

  const channelMode = await pickChannelMode()

  await savePreferences(channelMode)

  if (channelMode !== ChannelMode.TickerOnly) {
    try {
      const current = await getMyChannels()
      const next = await pickChannels(current)
      if (next.length === 0) {
        log.warn(
          "no channels selected — defaults (tech, finance) kept. change later via /dashboard/preferences"
        )
      } else {
        await putMyChannels(next)
        const labels = current.filter((c) => next.includes(c.key)).map((c) => c.label)
        log.success(`channels saved (${labels.join(", ")})`)
      }
    } catch (err) {
      log.warn(
        `channel picker skipped (${err instanceof Error ? err.message : String(err)}) — change later via /dashboard/preferences`
      )
    }
  }

  if (channelMode !== ChannelMode.NewsOnly) {
    try {
      const tickers = await pickWatchlistTickers()
      if (tickers.length === 0) {
        log.warn(
          "no tickers selected — markets/mix slots will be empty. add later via `distro watchlist add <SYMBOL>`."
        )
      } else {
        const lists = await getMyWatchlists()
        const primaryName = lists[0]?.name ?? "Default"
        // preserve any secondary lists verbatim — schema supports up to 3 lists/user
        // and a future multi-list ux must not silently drop them on init re-run.
        const trailing = lists.slice(1).map((l) => ({
          name: l.name,
          tickers: l.tickers.map((t) => ({ symbol: t.symbol, assetClass: t.assetClass })),
        }))
        await putMyWatchlists([{ name: primaryName, tickers }, ...trailing])
        log.success(`watchlist saved (${tickers.map((t) => t.symbol).join(", ")})`)
      }
    } catch (err) {
      log.warn(
        `watchlist picker skipped (${err instanceof Error ? err.message : String(err)}) — change later via /dashboard/watchlists`
      )
    }
  }

  await installHooks()
  await ensureDaemonRunning()
  await previewSlot()

  const ok = await runHealthCheck()
  printSummary()

  if (!ok) {
    outro("one or more health checks failed — see ✗ above")
    process.exit(1)
  }
  outro("all set — open a new Claude Code session to start earning")
}

export const initCmd = new Command("init")
  .description("guided onboarding wizard")
  .action(async () => {
    try {
      await runInit()
    } catch (err) {
      reportError(err)
    }
  })
