import { Command } from "commander"
import { intro, outro, select, text, confirm, log, isCancel, cancel } from "@clack/prompts"
import { ChannelMode, type SyncedPreferences } from "@distrotv/shared"
import { reportError } from "../lib/api-client.js"
import { readConfig, writeConfig } from "../lib/config.js"
import { getPreferences, putPreferences } from "../lib/preferences-client.js"
import { getMyChannels, putMyChannels } from "../lib/channels-client.js"
import { getMyWatchlists, putMyWatchlists } from "../lib/watchlists-client.js"
import { getMyAlerts, putMyAlerts } from "../lib/alerts-client.js"
import { pickChannelMode } from "../lib/prompts/preferences.js"
import { pickChannels } from "../lib/prompts/channels.js"
import { pickWatchlistTickers } from "../lib/prompts/watchlist.js"

type Action =
  | "mode"
  | "channels"
  | "watchlist"
  | "alerts"
  | "quiet-hours"
  | "tz"
  | "topics"
  | "cancel"

function minutesToHHMM(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

function hhmmToMinutes(s: string): number {
  const parts = s.split(":").map(Number)
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0)
}

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
      { value: "alerts", label: "alerts (global threshold)" },
      { value: "quiet-hours", label: "quiet hours (set start / end, blank to disable)" },
      { value: "tz", label: "tz offset (auto-detect or manual)" },
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

async function quietHoursAction(current: SyncedPreferences): Promise<void> {
  const startStr = await text({
    message: "quiet hours start (HH:MM, blank to disable)",
    initialValue: current.quietHoursStart != null ? minutesToHHMM(current.quietHoursStart) : "",
    validate: (v) => (v && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(v) ? "format HH:MM" : undefined),
  })
  if (isCancel(startStr)) return
  if (!startStr) {
    await putPreferences({ quietHoursStart: null, quietHoursEnd: null })
    log.success("quiet hours disabled")
    return
  }
  const endStr = await text({
    message: "quiet hours end (HH:MM)",
    initialValue: current.quietHoursEnd != null ? minutesToHHMM(current.quietHoursEnd) : "",
    validate: (v) => (!v || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(v) ? "format HH:MM" : undefined),
  })
  if (isCancel(endStr) || !endStr) return
  await putPreferences({
    quietHoursStart: hhmmToMinutes(startStr as string),
    quietHoursEnd: hhmmToMinutes(endStr),
  })
  log.success(`quiet hours set: ${startStr} → ${endStr}`)
}

async function tzAction(current: SyncedPreferences): Promise<void> {
  const detected = -new Date().getTimezoneOffset() // minutes, positive = east of UTC
  const sign = detected >= 0 ? "+" : ""
  const detectedLabel = `UTC${sign}${(detected / 60).toFixed(2).replace(/\.00$/, "")}`
  const useDetected = await confirm({
    message: `detected tz offset: ${detectedLabel}. use this?`,
    initialValue: true,
  })
  if (isCancel(useDetected)) return
  if (useDetected) {
    await putPreferences({ tzOffsetMinutes: detected })
    log.success(`tz offset set to ${detected} minutes (${detectedLabel})`)
    return
  }
  const manual = await text({
    message: "tz offset in minutes (e.g. -240 for EDT, 330 for IST)",
    initialValue: String(current.tzOffsetMinutes),
    validate: (v) => {
      const n = Number(v)
      return !Number.isInteger(n) || n < -720 || n > 840
        ? "must be integer between -720 and 840"
        : undefined
    },
  })
  if (isCancel(manual)) return
  await putPreferences({ tzOffsetMinutes: Number(manual) })
  log.success(`tz offset set to ${manual} minutes`)
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
      if (prefs.channelMode === ChannelMode.TickerOnly) {
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

    if (action === "alerts") {
      const current = await getMyAlerts()
      const globalRule = current.find((a) => a.scope === "global")
      const currentThreshold = globalRule?.thresholdPct ?? 5
      const input = await text({
        message: `global threshold (% daily move) — current: ${currentThreshold}`,
        placeholder: String(currentThreshold),
        validate: (v) => {
          if (v.length === 0) return undefined // empty = keep current
          const n = Number(v)
          if (!Number.isFinite(n) || n < 0.5 || n > 50) return "must be a number 0.5..50"
          return undefined
        },
      })
      if (isCancel(input)) continue
      const next = typeof input === "string" && input.length > 0 ? Number(input) : currentThreshold
      // preserve per-ticker overrides verbatim, replace just the global rule
      const replacement = [
        { scope: "global" as const, symbol: null, thresholdPct: next },
        ...current
          .filter((a) => a.scope === "per_ticker")
          .map((a) => ({
            scope: "per_ticker" as const,
            symbol: a.symbol,
            thresholdPct: a.thresholdPct,
          })),
      ]
      await putMyAlerts(replacement)
      log.success(`global threshold → ${next}%`)
      continue
    }

    if (action === "quiet-hours") {
      await quietHoursAction(prefs)
      prefs = await getPreferences()
      continue
    }

    if (action === "tz") {
      await tzAction(prefs)
      prefs = await getPreferences()
      continue
    }

    if (action === "topics") {
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
