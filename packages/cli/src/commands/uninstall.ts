import { lstatSync, unlinkSync } from "node:fs"
import { readFile, rm, stat, unlink, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { Command } from "commander"
import { cancel, confirm, intro, isCancel, log, note, outro } from "@clack/prompts"
import { resolveEnv } from "@distrotv/shared"
import { reportError } from "../lib/api-client.js"
import { readSettings, removeDevdripHooks, writeSettingsAtomic } from "../lib/claude-settings.js"
import { configDir, readConfig, writeConfig } from "../lib/config.js"
import { readDaemonStatus } from "../lib/daemon/lifecycle.js"
import { runStop } from "./daemon.js"

const DASHBOARD_URL = `${resolveEnv({ distroEnv: process.env["DISTRO_ENV"] ?? "prod" }).webUrl}/dashboard`

function claudeSettingsPath(): string {
  return join(homedir(), ".claude", "settings.json")
}

function claudeBackupPath(): string {
  return `${claudeSettingsPath()}.distro-backup`
}

function distroBinLinkPath(): string {
  return join(homedir(), ".distro", "bin", "distro")
}

async function restoreOrStripHooks(): Promise<{ restored: boolean; stripped: boolean }> {
  const settingsPath = claudeSettingsPath()
  const backupPath = claudeBackupPath()

  let backupRaw: string | null = null
  try {
    await stat(backupPath)
    backupRaw = await readFile(backupPath, "utf8")
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
  }

  if (backupRaw !== null) {
    // restore verbatim so the user gets their exact pre-install settings back.
    // skip JSON round-trip: the backup was produced by copyFile of the same
    // file, so byte-for-byte rewrite is the most honest recovery.
    await writeFile(settingsPath, backupRaw)
    try {
      await unlink(backupPath)
    } catch {
      /* non-fatal: the next init would overwrite it anyway */
    }
    return { restored: true, stripped: false }
  }

  // no backup — surgical strip
  const current = await readSettings(settingsPath)
  const { next, changed } = removeDevdripHooks(current)
  if (changed) {
    await writeSettingsAtomic(settingsPath, next)
  }
  return { restored: false, stripped: changed }
}

function removeBinSymlink(): boolean {
  const p = distroBinLinkPath()
  try {
    lstatSync(p)
  } catch {
    return false
  }
  try {
    unlinkSync(p)
    return true
  } catch {
    return false
  }
}

export async function runUninstall(opts: { yes?: boolean; purge?: boolean }): Promise<number> {
  intro("distro uninstall")

  if (!opts.yes) {
    const ok = await confirm({
      message: "remove distro tv? claude code keeps working normally.",
      initialValue: false,
    })
    if (isCancel(ok) || !ok) {
      cancel("cancelled")
      return 0
    }
  }

  // 1. stop daemon — must happen before any config/settings write so the
  // daemon's prefs-sync loop can't race us. runStop() logs its own outcome.
  await runStop()
  const after = readDaemonStatus()
  if (after.health === "running") {
    log.error("daemon still running after stop — aborting to avoid a write race")
    outro("uninstall aborted")
    return 1
  }

  // 2. restore or strip claude code hooks
  try {
    const { restored, stripped } = await restoreOrStripHooks()
    if (restored) log.success("restored ~/.claude/settings.json from backup")
    else if (stripped) log.success("removed distro hooks from ~/.claude/settings.json")
    else log.info("no distro hooks found in settings.json")
  } catch (err) {
    log.warn(`hook removal failed: ${(err as Error).message}`)
  }

  // 3. drop the cli symlink so a future `which distro` can't dead-link into
  // ~/.distro/bin/. harmless if missing.
  if (removeBinSymlink()) log.success("removed ~/.distro/bin/distro symlink")

  // 4. print data retention note BEFORE any purge.
  note(
    [
      "your reading history + preferences are preserved in ~/.distro/",
      `dashboard: ${DASHBOARD_URL}`,
      "re-run `distro init` anytime to reconnect",
    ].join("\n"),
    "data"
  )

  // 5. either keep local state (default) or purge it.
  if (opts.purge) {
    try {
      await rm(configDir(), { recursive: true, force: true })
      log.success(`purged ${configDir()}`)
    } catch (err) {
      log.warn(`purge failed: ${(err as Error).message}`)
    }
  } else {
    // keep the ledger + config, but clear cfg.cli.binPath so a fresh
    // `distro init` starts from a clean hook path (the old symlink is gone).
    const cfg = await readConfig()
    if (cfg && cfg.cli?.binPath) {
      await writeConfig({ ...cfg, cli: { binPath: "" } })
    }
    log.info(`kept ${configDir()} (use --purge to delete local state)`)
  }

  outro("done — run `npm uninstall -g @distrotv/cli` to remove the binary")
  return 0
}

export const uninstallCmd = new Command("uninstall")
  .description("clean removal of hooks, daemon, and data")
  .option("-y, --yes", "skip confirmation prompt")
  .option("--purge", "also delete ~/.distro/ (ledger + cache + config)")
  .action(async (opts: { yes?: boolean; purge?: boolean }) => {
    try {
      const code = await runUninstall(opts)
      process.exit(code)
    } catch (err) {
      reportError(err)
      process.exit(1)
    }
  })
