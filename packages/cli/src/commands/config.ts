import { Command } from "commander"
import { cancel, confirm, intro, isCancel, log, note, outro, select, text } from "@clack/prompts"
import { defaultDevdripPreferences, type DevdripPreferences } from "@distrotv/shared"
import { daemonSocketPath } from "@distrotv/shared/daemon-socket"
import { readConfig, writeConfig } from "../lib/config.js"
import { sendHookEvent } from "../lib/daemon/hook-client.js"
import { NotAuthenticatedError, reportError } from "../lib/api-client.js"

// Keys a user can tweak via --set / --get. Order matches --list output.
const EDITABLE_KEYS = ["quietHoursStart", "quietHoursEnd", "nightMode"] as const
type EditableKey = (typeof EDITABLE_KEYS)[number]

function isEditableKey(key: string): key is EditableKey {
  return (EDITABLE_KEYS as readonly string[]).includes(key)
}

function parseBoundedInt(raw: string, opts: { min: number; max: number; field: string }): number {
  const n = Number(raw)
  if (!Number.isInteger(n)) {
    throw new Error(`${opts.field}: expected integer, got "${raw}"`)
  }
  if (n < opts.min || n > opts.max) {
    throw new Error(`${opts.field}: must be between ${opts.min} and ${opts.max} (got ${n})`)
  }
  return n
}

function parseBool(raw: string, field: string): boolean {
  const v = raw.trim().toLowerCase()
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true
  if (v === "false" || v === "0" || v === "no" || v === "off") return false
  throw new Error(`${field}: expected boolean, got "${raw}"`)
}

function parseNullableHour(raw: string, field: string): number | null {
  const v = raw.trim().toLowerCase()
  if (v === "" || v === "null" || v === "off" || v === "none") return null
  return parseBoundedInt(raw, { min: 0, max: 23, field })
}

function applySetOne(prefs: DevdripPreferences, key: string, raw: string): DevdripPreferences {
  if (!isEditableKey(key)) {
    throw new Error(`unknown key "${key}" — valid: ${EDITABLE_KEYS.join(", ")}`)
  }
  switch (key) {
    case "quietHoursStart":
      return { ...prefs, quietHoursStart: parseNullableHour(raw, key) }
    case "quietHoursEnd":
      return { ...prefs, quietHoursEnd: parseNullableHour(raw, key) }
    case "nightMode":
      return { ...prefs, nightMode: parseBool(raw, key) }
  }
}

function splitSetPair(pair: string): { key: string; value: string } {
  const idx = pair.indexOf("=")
  if (idx <= 0) {
    throw new Error(`--set expected key=value, got "${pair}"`)
  }
  return { key: pair.slice(0, idx), value: pair.slice(idx + 1) }
}

function hoursChanged(a: DevdripPreferences, b: DevdripPreferences): boolean {
  return a.quietHoursStart !== b.quietHoursStart || a.quietHoursEnd !== b.quietHoursEnd
}

function prefsSummary(p: DevdripPreferences): Record<string, unknown> {
  return {
    quietHoursStart: p.quietHoursStart,
    quietHoursEnd: p.quietHoursEnd,
    nightMode: p.nightMode,
    tzOffsetMinutes: p.tzOffsetMinutes,
  }
}

async function notifyDaemon(): Promise<void> {
  // fire-and-forget. If the daemon isn't running that's fine; when it starts
  // it re-reads config. The file watcher also catches direct JSON edits.
  await sendHookEvent({ type: "reload-config" }, daemonSocketPath())
}

async function persist(next: DevdripPreferences): Promise<void> {
  const cfg = await readConfig()
  if (!cfg) {
    throw new NotAuthenticatedError("not initialized — run `distro init` first")
  }
  await writeConfig({
    apiUrl: cfg.apiUrl,
    auth: cfg.auth,
    user: cfg.user,
    device: cfg.device,
    cli: cfg.cli,
    preferences: next,
  })
}

// ── scripting paths ────────────────────────────────────────────────────────

async function runList(): Promise<void> {
  const cfg = await readConfig()
  if (!cfg) throw new NotAuthenticatedError("not initialized — run `distro init` first")
  console.log(JSON.stringify(prefsSummary(cfg.preferences), null, 2))
}

async function runGet(key: string): Promise<void> {
  if (!isEditableKey(key)) {
    throw new Error(`unknown key "${key}" — valid: ${EDITABLE_KEYS.join(", ")}`)
  }
  const cfg = await readConfig()
  if (!cfg) throw new NotAuthenticatedError("not initialized — run `distro init` first")
  const v = cfg.preferences[key]
  console.log(typeof v === "string" ? v : JSON.stringify(v))
}

async function runSet(pairs: string[]): Promise<void> {
  const cfg = await readConfig()
  if (!cfg) throw new NotAuthenticatedError("not initialized — run `distro init` first")
  let next = cfg.preferences
  for (const pair of pairs) {
    const { key, value } = splitSetPair(pair)
    next = applySetOne(next, key, value)
  }
  await persist(next)
  await notifyDaemon()
  const changed = pairs.map((p) => splitSetPair(p).key)
  log.success(`updated ${changed.join(", ")}`)
}

async function runReset(): Promise<void> {
  const cfg = await readConfig()
  if (!cfg) throw new NotAuthenticatedError("not initialized — run `distro init` first")
  const next = defaultDevdripPreferences()
  await persist(next)
  await notifyDaemon()
  log.success("preferences reset to defaults")
}

// ── interactive wizard ─────────────────────────────────────────────────────

async function askNullableHour(
  prompt: string,
  initial: number | null,
  field: string
): Promise<number | null> {
  const raw = await text({
    message: prompt,
    placeholder: "0–23, or 'off' to disable",
    initialValue: initial === null ? "off" : String(initial),
    validate: (v) => {
      try {
        parseNullableHour(v, field)
        return undefined
      } catch (err) {
        return (err as Error).message
      }
    },
  })
  if (isCancel(raw)) {
    cancel("cancelled")
    process.exit(0)
  }
  return parseNullableHour(raw as string, field)
}

async function askBool(prompt: string, initial: boolean): Promise<boolean> {
  const v = await confirm({ message: prompt, initialValue: initial })
  if (isCancel(v)) {
    cancel("cancelled")
    process.exit(0)
  }
  return v as boolean
}

async function editQuietHours(prefs: DevdripPreferences): Promise<DevdripPreferences> {
  const start = await askNullableHour(
    "Quiet hours start (hour of day)",
    prefs.quietHoursStart,
    "quietHoursStart"
  )
  const end = await askNullableHour(
    "Quiet hours end (hour of day)",
    prefs.quietHoursEnd,
    "quietHoursEnd"
  )
  return { ...prefs, quietHoursStart: start, quietHoursEnd: end }
}

async function editNightMode(prefs: DevdripPreferences): Promise<DevdripPreferences> {
  const on = await askBool(
    "Enable night mode? (suppresses ads 22:00–07:00 when no quiet hours are set)",
    prefs.nightMode
  )
  return { ...prefs, nightMode: on }
}

async function runInteractive(): Promise<void> {
  const cfg = await readConfig()
  if (!cfg) throw new NotAuthenticatedError("not initialized — run `distro init` first")

  intro("distro config")
  note(JSON.stringify(prefsSummary(cfg.preferences), null, 2), "current settings")

  let working = cfg.preferences

  while (true) {
    const choice = await select<string>({
      message: "What would you like to configure?",
      options: [
        { value: "quiet", label: "Quiet hours" },
        { value: "night", label: "Night mode toggle" },
        { value: "save", label: "Save & exit" },
        { value: "cancel", label: "Exit without saving" },
      ],
    })
    if (isCancel(choice) || choice === "cancel") {
      cancel("no changes saved")
      process.exit(0)
    }
    if (choice === "save") break

    switch (choice) {
      case "quiet":
        working = await editQuietHours(working)
        break
      case "night":
        working = await editNightMode(working)
        break
    }
    note(JSON.stringify(prefsSummary(working), null, 2), "updated (unsaved)")
  }

  // user may have moved timezone since last init — refresh on save
  working = { ...working, tzOffsetMinutes: -new Date().getTimezoneOffset() }

  await persist(working)
  await notifyDaemon()

  if (hoursChanged(cfg.preferences, working)) {
    log.info("daemon will apply new quiet hours on the next ad cycle")
  }
  outro("saved")
}

// ── command wiring ─────────────────────────────────────────────────────────

interface ConfigOpts {
  set?: string[]
  get?: string
  list?: boolean
  reset?: boolean
}

export const configCmd = new Command("config")
  .description("manage ad preferences")
  .option(
    "--set <kv>",
    "set one or more key=value pairs (repeatable)",
    (value: string, prev: string[] = []) => {
      prev.push(value)
      return prev
    }
  )
  .option("--get <key>", "print a single preference value")
  .option("--list", "print current preferences as JSON")
  .option("--reset", "restore default preferences")
  .action(async (opts: ConfigOpts) => {
    try {
      if (opts.reset) {
        await runReset()
        return
      }
      if (opts.list) {
        await runList()
        return
      }
      if (opts.get) {
        await runGet(opts.get)
        return
      }
      if (opts.set && opts.set.length > 0) {
        await runSet(opts.set)
        return
      }
      await runInteractive()
    } catch (err) {
      reportError(err)
    }
  })
