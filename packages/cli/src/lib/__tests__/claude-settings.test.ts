import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  mergeDevdripHooks,
  readSettings,
  writeSettingsAtomic,
  writeBackupOnce,
  type Settings,
} from "../claude-settings.js"

const BIN = "/abs/path/to/devdrip"

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

  it("is a no-op when our entries already exist with current bin path", () => {
    const existing: Settings = {
      hooks: {
        PreToolUse: [
          { matcher: "*", hooks: [{ type: "command", command: `${BIN} hook pre-tool` }] },
        ],
        Stop: [{ hooks: [{ type: "command", command: `${BIN} hook stop` }] }],
        UserPromptSubmit: [{ hooks: [{ type: "command", command: `${BIN} hook prompt-submit` }] }],
      },
    }
    const { next, changed } = mergeDevdripHooks(existing, BIN)
    expect(changed).toBe(false)
    expect(next.hooks?.PreToolUse).toHaveLength(1)
  })

  it("updates in place when bin path changed (nvm switch / version bump)", () => {
    const stale = "/old/path/devdrip"
    const existing: Settings = {
      hooks: {
        PreToolUse: [
          { matcher: "*", hooks: [{ type: "command", command: `${stale} hook pre-tool` }] },
        ],
        Stop: [{ hooks: [{ type: "command", command: `${stale} hook stop` }] }],
        UserPromptSubmit: [
          { hooks: [{ type: "command", command: `${stale} hook prompt-submit` }] },
        ],
      },
    }
    const { next, changed } = mergeDevdripHooks(existing, BIN)
    expect(changed).toBe(true)
    expect(next.hooks?.PreToolUse?.[0]?.hooks?.[0]?.command).toBe(`${BIN} hook pre-tool`)
    expect(next.hooks?.Stop?.[0]?.hooks?.[0]?.command).toBe(`${BIN} hook stop`)
    expect(next.hooks?.PreToolUse).toHaveLength(1)
  })

  it("throws on hooks shaped as a non-object", () => {
    expect(() =>
      mergeDevdripHooks({ hooks: "nope" as unknown as Settings["hooks"] }, BIN)
    ).toThrow()
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
    const backup = join(tempDir, "settings.json.devdrip-backup")
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
    const backup = join(tempDir, "missing.json.devdrip-backup")
    await writeBackupOnce(src, backup)
    expect(existsSync(backup)).toBe(true)
    expect(readFileSync(backup, "utf8")).toBe("{}\n")
  })
})
