import { Command } from "commander"
import { rm } from "node:fs/promises"
import { intro, log, outro } from "@clack/prompts"
import { apiFetch, ApiError } from "../lib/api-client.js"
import { configPath, readConfig } from "../lib/config.js"

export async function runLogout(): Promise<void> {
  intro("distro logout")

  const cfg = await readConfig()
  if (!cfg) {
    log.warn("no local config — nothing to do")
    outro("done")
    return
  }

  // best-effort: revoke device on backend
  try {
    await apiFetch("/auth/logout", { method: "POST" })
    log.success("device revoked on backend")
  } catch (err) {
    if (err instanceof ApiError) {
      log.warn(`backend logout failed (${err.message}) — wiping local config anyway`)
    } else {
      log.warn(`backend logout failed (offline?) — wiping local config anyway`)
    }
  }

  // wipe local config
  try {
    await rm(configPath(), { force: true })
    log.success(`removed ${configPath()}`)
  } catch (err) {
    log.warn(
      `could not remove ${configPath()}: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  outro("signed out — run `distro init` to sign back in")
}

export const logoutCmd: Command = new Command("logout")
  .description("sign out of distro and remove local config")
  .action(async () => {
    await runLogout()
  })
