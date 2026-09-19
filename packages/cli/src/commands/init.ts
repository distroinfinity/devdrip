import { mkdir } from "node:fs/promises"
import { homedir, hostname, platform } from "node:os"
import { resolve } from "node:path"
import { statSync } from "node:fs"
import { join } from "node:path"
import { Command } from "commander"
import { multiselect, intro, outro, cancel, isCancel, log, note } from "@clack/prompts"
import { AdCategory } from "@devdrip/shared"
import { ApiError, NotAuthenticatedError, reportError } from "../lib/api-client.js"
import { readConfig, writeConfig } from "../lib/config.js"
import {
  readSettings,
  writeSettingsAtomic,
  writeBackupOnce,
  mergeDevdripHooks,
} from "../lib/claude-settings.js"
import { putPreferences } from "../lib/preferences-client.js"
import { runInitHealthCheck } from "../lib/health.js"
import { runDemo } from "./demo.js"
import { registerDevice } from "../lib/device.js"
import { runLogin } from "./auth.js"

const CATEGORY_LABELS: Record<AdCategory, string> = {
  [AdCategory.CloudInfrastructure]: "Cloud & infrastructure",
  [AdCategory.DeveloperTools]: "Developer tools",
  [AdCategory.Databases]: "Databases",
  [AdCategory.MonitoringObservability]: "Monitoring & observability",
  [AdCategory.DeveloperRecruiting]: "Developer recruiting / jobs",
  [AdCategory.DeveloperEducation]: "Developer education",
  [AdCategory.SaasProducts]: "SaaS products",
}

const ALL_CATEGORIES = Object.values(AdCategory) as AdCategory[]

function claudeDir(): string {
  return join(homedir(), ".claude")
}

function claudeSettingsPath(): string {
  return join(claudeDir(), "settings.json")
}

function claudeBackupPath(): string {
  return `${claudeSettingsPath()}.devdrip-backup`
}

function resolveBinPath(): string {
  const arg = process.argv[1]
  if (!arg) return ""
  try {
    if (!statSync(arg).isFile()) return arg
    return resolve(arg)
  } catch {
    return arg
  }
}

async function ensureAuth(): Promise<void> {
  const cfg = await readConfig()
  if (cfg) {
    log.success(`signed in as @${cfg.user.githubLogin || cfg.user.email}`)
    return
  }
  log.info("no local session — starting GitHub sign-in…")
  await runLogin(false)
  const after = await readConfig()
  if (!after) throw new NotAuthenticatedError("sign-in did not complete")
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
  })
  const status = previousId && previousId === device.id ? "confirmed" : "registered"
  log.success(`device ${status}: ${hostname()} (${platform()}/${device.ideType})`)
  return { deviceId: device.id }
}

async function pickCategories(current: AdCategory[]): Promise<AdCategory[]> {
  // multiselect pre-checks the categories the user WANTS to see (i.e., not blocked).
  // selection returns allowed; we invert back to blocked for the backend.
  const preCheckedAllowed = ALL_CATEGORIES.filter((c) => !current.includes(c))

  const selected = await multiselect<AdCategory>({
    message: "Which categories would you like to see ads from?",
    options: ALL_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
    initialValues: preCheckedAllowed,
    required: false,
  })

  if (isCancel(selected)) {
    cancel("cancelled")
    process.exit(0)
  }

  const allowed = selected as AdCategory[]
  return ALL_CATEGORIES.filter((c) => !allowed.includes(c))
}

async function savePreferences(blocked: AdCategory[]): Promise<void> {
  const tzOffsetMinutes = -new Date().getTimezoneOffset()
  await putPreferences({ blockedCategories: blocked, tzOffsetMinutes })
  log.success(
    blocked.length === 0
      ? "preferences saved (all categories allowed)"
      : `preferences saved (${blocked.length} categor${blocked.length === 1 ? "y" : "ies"} blocked)`
  )
}

async function installHooks(): Promise<void> {
  const settingsPath = claudeSettingsPath()
  const backupPath = claudeBackupPath()
  const binPath = resolveBinPath()
  if (!binPath.trim()) {
    throw new Error("unable to resolve the devdrip binary path for Claude hooks")
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
      log.warn("preview unavailable — run `devdrip demo` after your next Claude session")
      return
    }
    if (err instanceof Error && err.message === "device not registered — run `devdrip init`") {
      log.warn("preview unavailable — run `devdrip demo` after your next Claude session")
      return
    }
    if (err instanceof TypeError && /fetch/i.test(err.message)) {
      log.warn("preview unavailable — run `devdrip demo` after your next Claude session")
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
      "→ dashboard: https://devdrip.xyz (coming soon)",
      "→ run `devdrip status` to see your earnings",
    ].join("\n"),
    "what's next"
  )
}

export async function runInit(): Promise<void> {
  intro("devdrip init — let's get you earning")

  await ensureAuth()
  await ensureClaudeDir()
  await ensureDevice()

  // GET /preferences doesn't exist yet (S4-06) — MVP init starts with no blocks pre-checked
  const blocked = await pickCategories([])
  await savePreferences(blocked)

  await installHooks()
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
