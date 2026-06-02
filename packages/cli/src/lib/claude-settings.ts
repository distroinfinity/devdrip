import { randomBytes } from "node:crypto"
import { copyFile, readFile, rename, stat, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import {
  clearWrappedStatusLine,
  readWrappedStatusLine,
  writeWrappedStatusLine,
} from "./wrapped-statusline.js"

export interface HookCommand {
  type: "command"
  command: string
}

export interface HookGroup {
  matcher?: string
  hooks: HookCommand[]
}

export interface StatusLineConfig {
  type: "command"
  command: string
  padding?: number
}

export interface Settings {
  hooks?: {
    PreToolUse?: HookGroup[]
    Stop?: HookGroup[]
    UserPromptSubmit?: HookGroup[]
    SessionStart?: HookGroup[]
    [k: string]: HookGroup[] | undefined
  }
  statusLine?: StatusLineConfig | unknown
  [k: string]: unknown
}

// includes the pre-pivot `devdrip` binary name so old hooks (~/.devdrip/bin/devdrip)
// are recognized — removeDevdripHooks then strips them and mergeDevdripHooks
// stale-replaces them with the current distro command.
const DISTRO_BIN_RE = /^(?:distro|dtv|devdrip)(?:\.js|\.mjs|\.cjs|\.exe)?$/i
const DISTRO_COMMAND_RE =
  /^\s*(?:"((?:\\.|[^"])*)"|'([^']*)'|(\S+))\s+hook\s+(pre-tool|stop|prompt-submit|session-start|session-end)(?:\s|$)/

export type HookEvent = "PreToolUse" | "Stop" | "UserPromptSubmit" | "SessionStart" | "SessionEnd"
type Sub = "pre-tool" | "stop" | "prompt-submit" | "session-start" | "session-end"

const EVENTS: Array<{ event: HookEvent; sub: Sub; matcher?: string }> = [
  { event: "PreToolUse", sub: "pre-tool", matcher: "*" },
  { event: "Stop", sub: "stop" },
  { event: "UserPromptSubmit", sub: "prompt-submit" },
  { event: "SessionStart", sub: "session-start" },
  { event: "SessionEnd", sub: "session-end" },
]

function quoteShellArg(arg: string): string {
  if (arg.length === 0) return '""'
  if (!/[\s"'\\$`]/.test(arg)) return arg
  return `"${arg.replace(/["\\$`]/g, "\\$&")}"`
}

function unescapeDoubleQuoted(value: string): string {
  return value.replace(/\\(["\\$`])/g, "$1")
}

function parseDevdripCommand(command: string): { binPath: string; sub: Sub } | null {
  const match = DISTRO_COMMAND_RE.exec(command)
  if (!match) return null

  const quotedDouble = match[1]
  const quotedSingle = match[2]
  const bare = match[3]
  const sub = match[4] as Sub
  const binPath =
    quotedDouble !== undefined ? unescapeDoubleQuoted(quotedDouble) : (quotedSingle ?? bare ?? "")

  if (!DISTRO_BIN_RE.test(basename(binPath))) return null
  return { binPath, sub }
}

function buildDevdripCommand(binPath: string, sub: Sub): string {
  return `${quoteShellArg(binPath)} hook ${sub}`
}

function isDevdripGroup(
  group: HookGroup,
  binPath: string,
  sub: Sub
): { match: boolean; stale: boolean } {
  for (const h of group.hooks ?? []) {
    if (typeof h.command !== "string") continue
    const parsed = parseDevdripCommand(h.command)
    if (!parsed || parsed.sub !== sub) continue
    if (parsed.binPath === binPath) return { match: true, stale: false }
    return { match: true, stale: true }
  }
  return { match: false, stale: false }
}

export function getMissingDevdripHookEvents(settings: Settings, binPath: string): HookEvent[] {
  if (binPath.length === 0) {
    return EVENTS.map(({ event }) => event)
  }

  return EVENTS.filter(({ event, sub }) => {
    const groups = settings.hooks?.[event] ?? []
    return !groups.some((group) => isDevdripGroup(group, binPath, sub).match)
  }).map(({ event }) => event)
}

// Reverse of mergeDevdripHooks — strips every hook that matches the devdrip
// command shape (any binPath, stale or current), drops groups it empties, and
// drops events whose group arrays it empties. Works even if cfg.cli.binPath
// drifted away from what's on disk (stale symlink, old install), because
// detection runs through parseDevdripCommand's regex rather than string match.
export function removeDevdripHooks(settings: Settings): { next: Settings; changed: boolean } {
  if (settings.hooks === undefined) return { next: settings, changed: false }
  if (typeof settings.hooks !== "object" || Array.isArray(settings.hooks)) {
    throw new Error("settings.hooks must be an object")
  }

  let changed = false
  const nextHooks: Record<string, HookGroup[]> = {}

  for (const [event, groups] of Object.entries(settings.hooks)) {
    if (!Array.isArray(groups)) {
      // non-standard shape — leave it alone
      nextHooks[event] = groups as unknown as HookGroup[]
      continue
    }
    const cleanedGroups: HookGroup[] = []
    for (const g of groups) {
      if (!g || !Array.isArray(g.hooks)) {
        cleanedGroups.push(g)
        continue
      }
      const keptHooks = g.hooks.filter(
        (h) => !(typeof h.command === "string" && parseDevdripCommand(h.command) !== null)
      )
      if (keptHooks.length === g.hooks.length) {
        cleanedGroups.push(g)
        continue
      }
      changed = true
      if (keptHooks.length > 0) {
        cleanedGroups.push({ ...g, hooks: keptHooks })
      }
    }
    if (cleanedGroups.length > 0) {
      nextHooks[event] = cleanedGroups
    } else if (groups.length > 0) {
      // every group in this event was ours — drop the event key entirely
      changed = true
    }
  }

  const next: Settings = { ...settings }
  if (Object.keys(nextHooks).length === 0) {
    delete next.hooks
    if (Object.keys(settings.hooks).length > 0 && !changed) {
      // hooks was an empty object already; safe to keep as-is. don't flip changed.
    }
  } else {
    next.hooks = nextHooks as Settings["hooks"]
  }
  return { next, changed }
}

export function mergeDevdripHooks(
  settings: Settings,
  binPath: string
): { next: Settings; changed: boolean } {
  if (
    settings.hooks !== undefined &&
    (typeof settings.hooks !== "object" || Array.isArray(settings.hooks))
  ) {
    throw new Error("settings.hooks must be an object")
  }

  const next: Settings = { ...settings, hooks: { ...(settings.hooks ?? {}) } }
  let changed = false

  for (const { event, sub, matcher } of EVENTS) {
    const groups = [...(next.hooks?.[event] ?? [])]
    const desiredCmd = buildDevdripCommand(binPath, sub)
    const ours: HookGroup = {
      ...(matcher !== undefined ? { matcher } : {}),
      hooks: [{ type: "command", command: desiredCmd }],
    }

    let found = false
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i]
      if (g === undefined) continue
      const id = isDevdripGroup(g, binPath, sub)
      if (!id.match) continue
      found = true
      if (id.stale) {
        groups[i] = ours
        changed = true
      }
    }
    if (!found) {
      groups.push(ours)
      changed = true
    }
    if (next.hooks) next.hooks[event] = groups
  }

  return { next, changed }
}

function buildStatusLineCommand(binPath: string): string {
  return `${quoteShellArg(binPath)} statusline`
}

// matches "<bin> statusline" (bare / single / double quoted), capturing the bin
const STATUSLINE_COMMAND_RE = /^\s*(?:"((?:\\.|[^"])*)"|'([^']*)'|(\S+))\s+statusline\s*$/

// True when `command` is our own "<distro-bin> statusline".
function isOurStatusLineCommand(command: unknown): boolean {
  if (typeof command !== "string") return false
  const m = STATUSLINE_COMMAND_RE.exec(command)
  if (!m) return false
  const bin = m[1] !== undefined ? unescapeDoubleQuoted(m[1]) : (m[2] ?? m[3] ?? "")
  return DISTRO_BIN_RE.test(basename(bin))
}

// Point Claude Code's statusLine at `distro statusline` so it renders the
// current slot at the bottom. Idempotent — no-op if already pointed at binPath.
//
// Claude's statusLine is a SINGLE command slot, so before we take it over we
// stash any pre-existing user command (see wrapped-statusline.ts); `distro
// statusline` then runs it and appends our line below, and uninstall restores
// it. Re-captures if the user later swaps in a new custom command.
export function setStatusLine(
  settings: Settings,
  binPath: string
): { next: Settings; changed: boolean } {
  const command = buildStatusLineCommand(binPath)
  const current = settings.statusLine as
    | { type?: unknown; command?: unknown; padding?: unknown }
    | undefined

  if (current && typeof current === "object" && typeof current.command === "string") {
    if (isOurStatusLineCommand(current.command)) {
      // already ours — leave any previously-captured wrapped command intact.
      if (current.command === command) return { next: settings, changed: false }
    } else {
      // foreign command — preserve it so we can chain + later restore it.
      writeWrappedStatusLine({
        type: typeof current.type === "string" ? current.type : "command",
        command: current.command,
        ...(typeof current.padding === "number" ? { padding: current.padding } : {}),
      })
    }
  }

  return {
    next: { ...settings, statusLine: { type: "command", command, padding: 0 } },
    changed: true,
  }
}

// On uninstall, restore the user's original status line if we wrapped one;
// otherwise strip the entry — but only when it's ours, so we never clobber a
// custom status line the user added after us.
export function removeStatusLine(settings: Settings): { next: Settings; changed: boolean } {
  const current = settings.statusLine as { command?: unknown } | undefined
  if (!current || typeof current !== "object" || typeof current.command !== "string") {
    return { next: settings, changed: false }
  }
  if (!isOurStatusLineCommand(current.command)) return { next: settings, changed: false }

  const wrapped = readWrappedStatusLine()
  if (wrapped) {
    const restored: StatusLineConfig = {
      type: "command",
      command: wrapped.command,
      ...(typeof wrapped.padding === "number" ? { padding: wrapped.padding } : {}),
    }
    clearWrappedStatusLine()
    return { next: { ...settings, statusLine: restored }, changed: true }
  }

  const next = { ...settings }
  delete next.statusLine
  return { next, changed: true }
}

export async function readSettings(path: string): Promise<Settings> {
  try {
    const raw = await readFile(path, "utf8")
    const parsed = JSON.parse(raw) as Settings
    return parsed
  } catch (err) {
    if (isNotFound(err)) return {}
    throw err
  }
}

export async function writeSettingsAtomic(path: string, settings: Settings): Promise<void> {
  const tmp = join(dirname(path), `.settings.${randomBytes(6).toString("hex")}.tmp`)
  await writeFile(tmp, JSON.stringify(settings, null, 2) + "\n")
  await rename(tmp, path)
}

export async function writeBackupOnce(srcPath: string, backupPath: string): Promise<void> {
  try {
    await stat(backupPath)
    return // already exists — preserve it
  } catch (err) {
    if (!isNotFound(err)) throw err
  }
  try {
    await copyFile(srcPath, backupPath)
  } catch (err) {
    if (!isNotFound(err)) throw err
    await writeFile(backupPath, "{}\n")
  }
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "ENOENT"
  )
}
