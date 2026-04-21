import { randomBytes } from "node:crypto"
import { copyFile, readFile, rename, stat, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

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

const DEVDRIP_SUB_RE = /\shook\s+(pre-tool|stop|prompt-submit)(\s|$)/

type Event = "PreToolUse" | "Stop" | "UserPromptSubmit"
type Sub = "pre-tool" | "stop" | "prompt-submit"

const EVENTS: Array<{ event: Event; sub: Sub; matcher?: string }> = [
  { event: "PreToolUse", sub: "pre-tool", matcher: "*" },
  { event: "Stop", sub: "stop" },
  { event: "UserPromptSubmit", sub: "prompt-submit" },
]

function isDevdripGroup(group: HookGroup, binPath: string): { match: boolean; stale: boolean } {
  for (const h of group.hooks ?? []) {
    if (typeof h.command !== "string") continue
    if (!DEVDRIP_SUB_RE.test(h.command)) continue
    if (h.command.startsWith(binPath + " ")) return { match: true, stale: false }
    return { match: true, stale: true }
  }
  return { match: false, stale: false }
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
    const desiredCmd = `${binPath} hook ${sub}`
    const ours: HookGroup = {
      ...(matcher !== undefined ? { matcher } : {}),
      hooks: [{ type: "command", command: desiredCmd }],
    }

    let found = false
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i]
      if (g === undefined) continue
      const id = isDevdripGroup(g, binPath)
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
    return parsed ?? {}
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
