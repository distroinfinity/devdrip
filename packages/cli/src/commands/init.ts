import { mkdir } from "node:fs/promises"
import { homedir, hostname, platform } from "node:os"
import { lstatSync, mkdirSync, realpathSync, statSync, symlinkSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import { Command } from "commander"
import { intro, outro, log, note } from "@clack/prompts"
import type { AdCategory } from "@distrotv/shared"
import { ChannelMode } from "@distrotv/shared"
import { ApiError, NotAuthenticatedError, reportError } from "../lib/api-client.js"
import { readConfig, writeConfig } from "../lib/config.js"
import {
  readSettings,
  writeSettingsAtomic,
  writeBackupOnce,
  mergeDevdripHooks,
} from "../lib/claude-settings.js"
import { putPreferences } from "../lib/preferences-client.js"
import { pickCategories, pickChannelMode } from "../lib/prompts/preferences.js"
import { runInitHealthCheck } from "../lib/health.js"
import { runDemo } from "./demo.js"
import { registerDevice } from "../lib/device.js"

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

async function ensureDevice(): Promise<{ deviceId: string }> {
  const cfg = await readConfig()
  if (!cfg) throw new NotAuthenticatedError()

  const previousId = cfg.device?.id
  const device = await registerDevice()
  await writeConfig({
    apiUrl: cfg.apiUrl,
    auth: cfg.auth,
    user: cfg.user,
    device: { id: device.id },
    cli: cfg.cli,
    preferences: cfg.preferences,
  })
  const status = previousId && previousId === device.id ? "confirmed" : "registered"
  log.success(`device ${status}: ${hostname()} (${platform()}/${device.ideType})`)
  return { deviceId: device.id }
}

async function savePreferences(blocked: AdCategory[], channelMode: ChannelMode): Promise<void> {
  const tzOffsetMinutes = -new Date().getTimezoneOffset()
  const updated = await putPreferences({ blockedCategories: blocked, tzOffsetMinutes, channelMode })
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
  log.success(
    blocked.length === 0
      ? `preferences saved (mode: ${channelMode}, all categories allowed)`
      : `preferences saved (mode: ${channelMode}, ${blocked.length} categor${blocked.length === 1 ? "y" : "ies"} blocked)`
  )
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

async function previewAd(): Promise<void> {
  log.step("preview ad from the real pipeline")
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

function printSummary(): void {
  note(
    [
      "→ dashboard: https://distrotv.xyz/dashboard",
      "→ run `distro status` to see your earnings",
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
  intro("distro init — let's get you earning")

  await ensureClaudeDir()
  await ensureDevice()

  // channel mode picker first — gates whether to ask about ad categories
  const channelMode = await pickChannelMode()

  // learn-mode users skip the categories prompt entirely. do NOT auto-set
  // blocked = ALL_CATEGORIES — the mode itself is the gate (delivery checks
  // channelMode), and a later flip back to earn/mix should preserve any
  // category prefs the user set today.
  let blocked: AdCategory[] = []
  if (channelMode === ChannelMode.Earn || channelMode === ChannelMode.Mix) {
    blocked = await pickCategories([])
  }

  await savePreferences(blocked, channelMode)

  await installHooks()
  await ensureDaemonRunning()
  await previewAd()

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
