import { Command } from "commander"
import { intro, outro, select, log, isCancel, cancel } from "@clack/prompts"
import type { ChannelMode, SyncedPreferences } from "@distrotv/shared"
import { reportError } from "../lib/api-client.js"
import { readConfig, writeConfig } from "../lib/config.js"
import { getPreferences, putPreferences } from "../lib/preferences-client.js"
import { pickChannelMode, pickCategories } from "../lib/prompts/preferences.js"

type Action = "mode" | "categories" | "caps" | "topics" | "cancel"

async function mirrorToLocal(updated: SyncedPreferences): Promise<void> {
  const cfg = await readConfig()
  if (!cfg) return
  await writeConfig({
    apiUrl: cfg.apiUrl,
    auth: cfg.auth,
    user: cfg.user,
    device: cfg.device,
    cli: cfg.cli,
    preferences: { ...cfg.preferences, ...updated },
  })
}

async function showMenu(currentMode: ChannelMode): Promise<Action> {
  const choice = await select<Action>({
    message: "what would you like to change?",
    options: [
      { value: "mode", label: `channel mode (currently: ${currentMode})` },
      { value: "categories", label: "ad categories" },
      { value: "caps", label: "caps & quiet hours (coming soon)" },
      { value: "topics", label: "news topics (v1.1 — coming soon)" },
      { value: "cancel", label: "cancel" },
    ],
  })
  if (isCancel(choice)) {
    cancel("cancelled")
    process.exit(0)
  }
  return choice as Action
}

async function runPreferences(): Promise<void> {
  intro("distro preferences")
  let prefs = await getPreferences()

  // loop until cancel so multi-edit in one session works
  while (true) {
    const action = await showMenu(prefs.channelMode)
    if (action === "cancel") break

    if (action === "mode") {
      const next = await pickChannelMode(prefs.channelMode)
      if (next === prefs.channelMode) {
        log.info("no change")
        continue
      }
      prefs = await putPreferences({ channelMode: next })
      await mirrorToLocal(prefs)
      log.success(`channel mode → ${next}`)
      continue
    }

    if (action === "categories") {
      const blocked = await pickCategories(prefs.blockedCategories)
      prefs = await putPreferences({ blockedCategories: blocked })
      await mirrorToLocal(prefs)
      log.success(
        blocked.length === 0
          ? "all categories allowed"
          : `${blocked.length} categor${blocked.length === 1 ? "y" : "ies"} blocked`
      )
      continue
    }

    if (action === "caps" || action === "topics") {
      log.info("not available in mvp — coming in a later release")
      continue
    }
  }

  outro("done")
}

export const preferencesCmd = new Command("preferences")
  .alias("prefs")
  .description("change channel mode, ad categories, and other settings")
  .action(async () => {
    try {
      await runPreferences()
    } catch (err) {
      reportError(err)
    }
  })
