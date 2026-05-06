import { Command } from "commander"
import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  multiselect,
  note,
  outro,
  select,
  text,
} from "@clack/prompts"
import {
  AdCategory,
  daemonSocketPath,
  defaultDevdripPreferences,
  type DevdripPreferences,
} from "@distrotv/shared"
import { readConfig, writeConfig } from "../lib/config.js"
import { sendHookEvent } from "../lib/daemon/hook-client.js"
import { putPreferences } from "../lib/preferences-client.js"
import { ApiError, NotAuthenticatedError, reportError } from "../lib/api-client.js"

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

// Keys a user can tweak via --set / --get. Order matches --list output.
const EDITABLE_KEYS = [
  "blockedCategories",
  "maxPerHour",
  "maxPerDay",
  "sessionWarmupMs",
  "quietHoursStart",
  "quietHoursEnd",
  "nightMode",
] as const
type EditableKey = (typeof EDITABLE_KEYS)[number]

function isEditableKey(key: string): key is EditableKey {
  return (EDITABLE_KEYS as readonly string[]).includes(key)
}

function parseCategoriesCsv(input: string): AdCategory[] {
  if (input.trim() === "" || input.trim().toLowerCase() === "none") return []
  const parts = input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const result: AdCategory[] = []
  for (const p of parts) {
    if (!(ALL_CATEGORIES as string[]).includes(p)) {
      throw new Error(`unknown category "${p}" — valid: ${ALL_CATEGORIES.join(", ")}`)
    }
    result.push(p as AdCategory)
  }
  return result
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
    case "blockedCategories":
      return { ...prefs, blockedCategories: parseCategoriesCsv(raw) }
    case "maxPerHour":
      return {
        ...prefs,
        maxPerHour: parseBoundedInt(raw, { min: 0, max: 1000, field: key }),
      }
    case "maxPerDay":
      return {
        ...prefs,
        maxPerDay: parseBoundedInt(raw, { min: 0, max: 10_000, field: key }),
      }
    case "sessionWarmupMs":
      return {
        ...prefs,
        sessionWarmupMs: parseBoundedInt(raw, {
          min: 0,
          max: 24 * 60 * 60 * 1000,
          field: key,
        }),
      }
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

function categoriesChanged(a: DevdripPreferences, b: DevdripPreferences): boolean {
  const sa = a.blockedCategories.slice().sort().join(",")
  const sb = b.blockedCategories.slice().sort().join(",")
  return sa !== sb
}

function prefsSummary(p: DevdripPreferences): Record<string, unknown> {
  return {
    blockedCategories: p.blockedCategories,
    maxPerHour: p.maxPerHour,
    maxPerDay: p.maxPerDay,
    sessionWarmupMs: p.sessionWarmupMs,
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

async function syncCategoriesToBackend(prefs: DevdripPreferences): Promise<void> {
  try {
    await putPreferences({
      blockedCategories: prefs.blockedCategories,
      tzOffsetMinutes: prefs.tzOffsetMinutes,
    })
  } catch (err) {
    if (err instanceof ApiError || err instanceof NotAuthenticatedError) {
      log.warn("could not sync categories to backend — will retry on next change")
      return
    }
    if (err instanceof TypeError && /fetch/i.test(err.message)) {
      log.warn("backend unreachable — categories saved locally only")
      return
    }
    throw err
  }
}

async function persist(next: DevdripPreferences): Promise<void> {
  const cfg = await readConfig()
  if (!cfg) {
    throw new NotAuthenticatedError("not initialized — run `devdrip init` first")
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
  if (!cfg) throw new NotAuthenticatedError("not initialized — run `devdrip init` first")
  console.log(JSON.stringify(prefsSummary(cfg.preferences), null, 2))
}

async function runGet(key: string): Promise<void> {
  if (!isEditableKey(key)) {
    throw new Error(`unknown key "${key}" — valid: ${EDITABLE_KEYS.join(", ")}`)
  }
  const cfg = await readConfig()
  if (!cfg) throw new NotAuthenticatedError("not initialized — run `devdrip init` first")
  const v = cfg.preferences[key]
  console.log(typeof v === "string" ? v : JSON.stringify(v))
}

async function runSet(pairs: string[]): Promise<void> {
  const cfg = await readConfig()
  if (!cfg) throw new NotAuthenticatedError("not initialized — run `devdrip init` first")
  let next = cfg.preferences
  for (const pair of pairs) {
    const { key, value } = splitSetPair(pair)
    next = applySetOne(next, key, value)
  }
  await persist(next)
  if (categoriesChanged(cfg.preferences, next)) {
    await syncCategoriesToBackend(next)
  }
  await notifyDaemon()
  const changed = pairs.map((p) => splitSetPair(p).key)
  log.success(`updated ${changed.join(", ")}`)
}

async function runReset(): Promise<void> {
  const cfg = await readConfig()
  if (!cfg) throw new NotAuthenticatedError("not initialized — run `devdrip init` first")
  const next = defaultDevdripPreferences()
  await persist(next)
  if (categoriesChanged(cfg.preferences, next)) {
    await syncCategoriesToBackend(next)
  }
  await notifyDaemon()
  log.success("preferences reset to defaults")
}

// ── interactive wizard ─────────────────────────────────────────────────────

async function pickCategoriesInteractive(current: AdCategory[]): Promise<AdCategory[]> {
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

async function askNumber(
  prompt: string,
  initial: number,
  opts: { min: number; max: number; field: string }
): Promise<number> {
  const raw = await text({
    message: prompt,
    initialValue: String(initial),
    validate: (v) => {
      try {
        parseBoundedInt(v, opts)
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
  return parseBoundedInt(raw as string, opts)
}

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

async function editCategories(prefs: DevdripPreferences): Promise<DevdripPreferences> {
  const blocked = await pickCategoriesInteractive(prefs.blockedCategories)
  return { ...prefs, blockedCategories: blocked }
}

async function editRateLimits(prefs: DevdripPreferences): Promise<DevdripPreferences> {
  const maxPerHour = await askNumber("Maximum ads per hour", prefs.maxPerHour, {
    min: 0,
    max: 1000,
    field: "maxPerHour",
  })
  const maxPerDay = await askNumber("Maximum ads per day", prefs.maxPerDay, {
    min: 0,
    max: 10_000,
    field: "maxPerDay",
  })
  return { ...prefs, maxPerHour, maxPerDay }
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

async function editWarmup(prefs: DevdripPreferences): Promise<DevdripPreferences> {
  const minutes = await askNumber(
    "Session warmup (minutes — no ads during this period after daemon start)",
    Math.round(prefs.sessionWarmupMs / 60_000),
    { min: 0, max: 24 * 60, field: "sessionWarmupMs" }
  )
  return { ...prefs, sessionWarmupMs: minutes * 60_000 }
}

async function runInteractive(): Promise<void> {
  const cfg = await readConfig()
  if (!cfg) throw new NotAuthenticatedError("not initialized — run `devdrip init` first")

  intro("devdrip config")
  note(JSON.stringify(prefsSummary(cfg.preferences), null, 2), "current settings")

  let working = cfg.preferences

  while (true) {
    const choice = await select<string>({
      message: "What would you like to configure?",
      options: [
        { value: "categories", label: "Categories (which ads to show)" },
        { value: "limits", label: "Rate limits (ads per hour / day)" },
        { value: "quiet", label: "Quiet hours" },
        { value: "night", label: "Night mode toggle" },
        { value: "warmup", label: "Session warmup duration" },
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
      case "categories":
        working = await editCategories(working)
        break
      case "limits":
        working = await editRateLimits(working)
        break
      case "quiet":
        working = await editQuietHours(working)
        break
      case "night":
        working = await editNightMode(working)
        break
      case "warmup":
        working = await editWarmup(working)
        break
    }
    note(JSON.stringify(prefsSummary(working), null, 2), "updated (unsaved)")
  }

  // user may have moved timezone since last init — refresh on save
  working = { ...working, tzOffsetMinutes: -new Date().getTimezoneOffset() }

  await persist(working)
  if (categoriesChanged(cfg.preferences, working)) {
    await syncCategoriesToBackend(working)
  }
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
