import { stat } from "node:fs/promises"
import { homedir, hostname, platform } from "node:os"
import { realpathSync } from "node:fs"
import { join } from "node:path"
import { Command } from "commander"
import { multiselect, intro, outro, cancel, isCancel } from "@clack/prompts"
import { AdCategory, REVENUE_SHARE_DEVELOPER } from "@devdrip/shared"
import { NotAuthenticatedError, reportError } from "../lib/api-client.js"
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
const DEFAULT_CPM = 0.8

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
    return realpathSync(arg)
  } catch {
    return arg
  }
}

async function ensureAuth(): Promise<void> {
  const cfg = await readConfig()
  if (cfg) {
    console.log(`✓ signed in as @${cfg.user.githubLogin || cfg.user.email}`)
    return
  }
  console.log("no local session — starting GitHub sign-in…")
  const { runLogin } = await import("./auth.js")
  await runLogin(false)
  const after = await readConfig()
  if (!after) throw new NotAuthenticatedError("sign-in did not complete")
}

async function ensureClaudeDir(): Promise<void> {
  try {
    await stat(claudeDir())
    console.log(`✓ Claude Code detected (${claudeDir()})`)
  } catch {
    console.error(
      `Claude Code not found at ${claudeDir()}. Install it first: https://claude.ai/download`
    )
    process.exit(1)
  }
}

async function ensureDevice(): Promise<{ deviceId: string }> {
  const cfg = await readConfig()
  if (!cfg) throw new NotAuthenticatedError()

  if (cfg.device?.id) {
    console.log(`✓ device: ${hostname()} (${platform()})`)
    return { deviceId: cfg.device.id }
  }

  const device = await registerDevice(cfg.auth.accessToken, cfg.apiUrl)
  await writeConfig({
    apiUrl: cfg.apiUrl,
    auth: cfg.auth,
    user: cfg.user,
    device: { id: device.id },
    cli: cfg.cli,
  })
  console.log(`✓ device: ${hostname()} (${platform()}/${device.ideType})`)
  return { deviceId: device.id }
}

async function pickCategories(current: AdCategory[]): Promise<AdCategory[]> {
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
  console.log(
    blocked.length === 0
      ? "✓ preferences saved (all categories allowed)"
      : `✓ preferences saved (${blocked.length} categor${blocked.length === 1 ? "y" : "ies"} blocked)`
  )
}

async function installHooks(): Promise<void> {
  const settingsPath = claudeSettingsPath()
  const backupPath = claudeBackupPath()
  const binPath = resolveBinPath()

  await writeBackupOnce(settingsPath, backupPath)

  const existing = await readSettings(settingsPath)
  const { next, changed } = mergeDevdripHooks(existing, binPath)
  if (!changed) {
    console.log(`✓ hooks already installed`)
    return
  }
  await writeSettingsAtomic(settingsPath, next)

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
  console.log(`✓ hooks installed in ${settingsPath}`)
}

async function previewAd(): Promise<void> {
  console.log("\nhere's a preview ad from the real pipeline:\n")
  await runDemo()
  console.log()
}

async function runHealthCheck(): Promise<boolean> {
  const cfg = await readConfig()
  if (!cfg) return false
  const probes = await runInitHealthCheck(cfg, claudeSettingsPath())
  console.log("\nhealth check:")
  for (const p of probes) {
    const mark = p.ok ? "✓" : "✗"
    const detail = p.detail ? ` (${p.detail})` : ""
    console.log(`  ${mark} ${p.name}${detail}`)
  }
  return probes.every((p) => p.ok)
}

function printSummary(): void {
  const hoursPerDay = 4
  const adsPerHourLight = 2
  const adsPerHourModerate = 4
  const cpm = DEFAULT_CPM
  const share = REVENUE_SHARE_DEVELOPER

  const low = hoursPerDay * adsPerHourLight * 30 * (cpm / 1000) * share
  const high = hoursPerDay * adsPerHourModerate * 30 * (cpm / 1000) * share
  const perAd = (cpm / 1000) * share

  console.log("")
  console.log("✓ all set.")
  console.log("")
  console.log(`early-mvp earnings estimate: ~$${low.toFixed(2)}–$${high.toFixed(2)}/month`)
  console.log(
    `  assumes ${hoursPerDay}h Claude usage/day · ${adsPerHourLight}–${adsPerHourModerate} ads/hr · $${cpm.toFixed(2)} CPM · ${Math.round(share * 100)}% dev share`
  )
  console.log(`  that's ~$${perAd.toFixed(5)} per ad — rates climb as premium campaigns join.`)
  console.log(`  → dashboard: https://devdrip.xyz (coming soon)`)
  console.log(`  → run \`devdrip status\` to see actual earnings`)
  console.log("")
  console.log("open a new Claude Code session to start earning.")
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
  outro("")
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
