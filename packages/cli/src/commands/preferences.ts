import { Command } from "commander"
import { intro, outro, select, log, isCancel, cancel } from "@clack/prompts"
import { ChannelMode, type SyncedPreferences } from "@distrotv/shared"
import { reportError } from "../lib/api-client.js"
import { readConfig, writeConfig } from "../lib/config.js"
import { getPreferences, putPreferences } from "../lib/preferences-client.js"
import { getMyChannels, putMyChannels } from "../lib/channels-client.js"
import { getMyWatchlists, putMyWatchlists } from "../lib/watchlists-client.js"
import { pickChannelMode } from "../lib/prompts/preferences.js"
import { pickChannels } from "../lib/prompts/channels.js"
import { pickWatchlistTickers } from "../lib/prompts/watchlist.js"

type Action = "mode" | "channels" | "watchlist" | "caps" | "topics" | "cancel"

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
      { value: "channels", label: "channels (tech / finance / crypto / …)" },
      { value: "watchlist", label: "watchlist (add / remove tickers)" },
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

    if (action === "channels") {
      if (prefs.channelMode === ChannelMode.Markets) {
        log.warn("channels are unused in markets mode — switch mode first if you want news")
      }
      const current = await getMyChannels()
      const next = await pickChannels(current)
      if (next.length === 0) {
        log.warn("at least one channel must stay on — keeping previous selection")
        continue
      }
      await putMyChannels(next)
      const labels = current.filter((c) => next.includes(c.key)).map((c) => c.label)
      log.success(labels.join(", "))
      continue
    }

    if (action === "watchlist") {
      const tickers = await pickWatchlistTickers()
      if (tickers.length === 0) {
        log.warn("at least one ticker must stay — keeping previous selection")
        continue
      }
      const lists = await getMyWatchlists()
      const primaryName = lists[0]?.name ?? "Default"
      // preserve secondary lists verbatim (multi-list schema; future ux will use)
      const trailing = lists.slice(1).map((l) => ({
        name: l.name,
        tickers: l.tickers.map((t) => ({ symbol: t.symbol, assetClass: t.assetClass })),
      }))
      await putMyWatchlists([{ name: primaryName, tickers }, ...trailing])
      log.success(tickers.map((t) => t.symbol).join(", "))
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
  .description("change channel mode, channels, and other settings")
  .action(async () => {
    try {
      await runPreferences()
    } catch (err) {
      reportError(err)
    }
  })
