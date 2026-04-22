import { randomBytes } from "node:crypto"
import { copyFile, readFile, rename, stat, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"

export interface HookCommand {
  type: "command"
  command: string
}

export interface HookGroup {
  matcher?: string
  hooks: HookCommand[]
}

export interface Settings {
  hooks?: {
    PreToolUse?: HookGroup[]
    Stop?: HookGroup[]
    UserPromptSubmit?: HookGroup[]
    [k: string]: HookGroup[] | undefined
  }
  [k: string]: unknown
}

const DEVDRIP_BIN_RE = /^devdrip(?:\.js|\.mjs|\.cjs|\.exe)?$/i
const DEVDRIP_COMMAND_RE =
  /^\s*(?:"((?:\\.|[^"])*)"|'([^']*)'|(\S+))\s+hook\s+(pre-tool|stop|prompt-submit)(?:\s|$)/

export type HookEvent = "PreToolUse" | "Stop" | "UserPromptSubmit"
type Sub = "pre-tool" | "stop" | "prompt-submit"

const EVENTS: Array<{ event: HookEvent; sub: Sub; matcher?: string }> = [
  { event: "PreToolUse", sub: "pre-tool", matcher: "*" },
  { event: "Stop", sub: "stop" },
  { event: "UserPromptSubmit", sub: "prompt-submit" },
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
  const match = DEVDRIP_COMMAND_RE.exec(command)
  if (!match) return null

  const quotedDouble = match[1]
  const quotedSingle = match[2]
  const bare = match[3]
  const sub = match[4] as Sub
  const binPath =
    quotedDouble !== undefined ? unescapeDoubleQuoted(quotedDouble) : (quotedSingle ?? bare ?? "")

  if (!DEVDRIP_BIN_RE.test(basename(binPath))) return null
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
