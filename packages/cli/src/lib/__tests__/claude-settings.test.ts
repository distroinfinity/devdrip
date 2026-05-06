import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  mergeDevdripHooks,
  readSettings,
  removeDevdripHooks,
  writeSettingsAtomic,
  writeBackupOnce,
  type Settings,
} from "../claude-settings.js"

const BIN = "/abs/path/to/devdrip"
const BIN_WITH_SPACES = "/abs/path with spaces/devdrip"

describe("mergeDevdripHooks", () => {
  it("adds all three events when settings are empty", () => {
    const { next, changed } = mergeDevdripHooks({}, BIN)
    expect(changed).toBe(true)
    expect(next.hooks?.PreToolUse).toHaveLength(1)
    expect(next.hooks?.Stop).toHaveLength(1)
    expect(next.hooks?.UserPromptSubmit).toHaveLength(1)
    expect(next.hooks?.PreToolUse?.[0]?.hooks?.[0]?.command).toBe(`${BIN} hook pre-tool`)
    expect(next.hooks?.PreToolUse?.[0]?.matcher).toBe("*")
  })

  it("preserves other tools' hook entries and appends ours", () => {
    const existing: Settings = {
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "/other/tool pre" }] }],
      },
    }
    const { next, changed } = mergeDevdripHooks(existing, BIN)
    expect(changed).toBe(true)
    expect(next.hooks?.PreToolUse).toHaveLength(2)
    expect(next.hooks?.PreToolUse?.[0]?.hooks?.[0]?.command).toBe("/other/tool pre")
    expect(next.hooks?.PreToolUse?.[1]?.hooks?.[0]?.command).toBe(`${BIN} hook pre-tool`)
  })

  it("throws on hooks shaped as a non-object", () => {
    expect(() =>
      mergeDevdripHooks({ hooks: "nope" as unknown as Settings["hooks"] }, BIN)
    ).toThrow()
  })

  it("does NOT claim other tools' hooks that happen to use matching subcommand names", () => {
    const existing: Settings = {
      hooks: {
        PreToolUse: [
          {
            hooks: [{ type: "command", command: "/other/tool hook pre-tool --verbose" }],
          },
        ],
        Stop: [
          {
            hooks: [{ type: "command", command: "/some/other-binary hook stop" }],
          },
        ],
      },
    }
    const { next, changed } = mergeDevdripHooks(existing, BIN)
    expect(changed).toBe(true) // because our groups get added
    // the other tools' groups remain, unmodified, in the first slot
    expect(next.hooks?.PreToolUse?.[0]?.hooks?.[0]?.command).toBe(
      "/other/tool hook pre-tool --verbose"
    )
    expect(next.hooks?.Stop?.[0]?.hooks?.[0]?.command).toBe("/some/other-binary hook stop")
    // our group is appended after
    expect(next.hooks?.PreToolUse).toHaveLength(2)
    expect(next.hooks?.PreToolUse?.[1]?.hooks?.[0]?.command).toBe(`${BIN} hook pre-tool`)
    expect(next.hooks?.Stop).toHaveLength(2)
    expect(next.hooks?.Stop?.[1]?.hooks?.[0]?.command).toBe(`${BIN} hook stop`)
  })

  it("quotes the executable path when it contains spaces", () => {
    const { next } = mergeDevdripHooks({}, BIN_WITH_SPACES)
    expect(next.hooks?.PreToolUse?.[0]?.hooks?.[0]?.command).toBe(
      `"${BIN_WITH_SPACES}" hook pre-tool`
    )
  })

  it("merges SessionStart hook", () => {
    const { next } = mergeDevdripHooks({}, "/Users/x/.distro/bin/devdrip")
    expect(next.hooks?.SessionStart).toBeDefined()
    expect(next.hooks?.SessionStart?.[0]?.hooks[0]?.command).toContain("hook session-start")
  })
})

describe("readSettings / writeSettingsAtomic / writeBackupOnce", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "devdrip-claude-"))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it("readSettings returns {} for missing file", async () => {
    const out = await readSettings(join(tempDir, "missing.json"))
    expect(out).toEqual({})
  })

  it("readSettings throws for malformed JSON", async () => {
    const p = join(tempDir, "bad.json")
    writeFileSync(p, "{not json")
    await expect(readSettings(p)).rejects.toThrow()
  })

  it("writeSettingsAtomic writes the file", async () => {
    const p = join(tempDir, "out.json")
    await writeSettingsAtomic(p, { hooks: { Stop: [] } })
    expect(JSON.parse(readFileSync(p, "utf8"))).toEqual({ hooks: { Stop: [] } })
  })

  it("writeBackupOnce copies src to backup only on first call", async () => {
    const src = join(tempDir, "settings.json")
    const backup = join(tempDir, "settings.json.distro-backup")
    writeFileSync(src, '{"a":1}')
    await writeBackupOnce(src, backup)
    expect(readFileSync(backup, "utf8")).toBe('{"a":1}')

    // modify source, call again — backup must not change
    writeFileSync(src, '{"a":2}')
    await writeBackupOnce(src, backup)
    expect(readFileSync(backup, "utf8")).toBe('{"a":1}')
  })

  it("writeBackupOnce writes {} when source is missing", async () => {
    const src = join(tempDir, "missing.json")
    const backup = join(tempDir, "missing.json.distro-backup")
    await writeBackupOnce(src, backup)
    expect(existsSync(backup)).toBe(true)
    expect(readFileSync(backup, "utf8")).toBe("{}\n")
  })
})

describe("removeDevdripHooks", () => {
  it("is a no-op on empty settings", () => {
    const { next, changed } = removeDevdripHooks({})
    expect(changed).toBe(false)
    expect(next).toEqual({})
  })

  it("is a no-op when no devdrip hooks are present", () => {
    const existing: Settings = {
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "/other/tool pre" }] }],
      },
    }
    const { next, changed } = removeDevdripHooks(existing)
    expect(changed).toBe(false)
    expect(next).toEqual(existing)
  })

  it("preserves non-hook settings keys verbatim", () => {
    const { next: installed } = mergeDevdripHooks({ editor: "vim" } as Settings, BIN)
    const { next } = removeDevdripHooks(installed)
    expect((next as Settings & { editor?: string }).editor).toBe("vim")
  })
})
