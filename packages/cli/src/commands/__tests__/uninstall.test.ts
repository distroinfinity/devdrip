import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

let home: string
const realHome = process.env["HOME"]

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "distro-uninstall-test-"))
  process.env["HOME"] = home
  mkdirSync(join(home, ".claude"), { recursive: true })
})

afterEach(() => {
  process.env["HOME"] = realHome
  rmSync(home, { recursive: true, force: true })
})

const BIN = "/Users/x/.distro/bin/distro"

describe("restoreOrStripHooks", () => {
  it("never restores a stale backup over settings the user changed after install", async () => {
    const settingsPath = join(home, ".claude", "settings.json")
    const backupPath = join(home, ".claude", "settings.json.distro-backup")
    // backup taken at install time — months old, missing everything added since
    writeFileSync(backupPath, JSON.stringify({ hooks: {} }))
    writeFileSync(
      settingsPath,
      JSON.stringify({
        model: "some-model",
        theme: "dark",
        enabledPlugins: { a: true, b: true },
        statusLine: { type: "command", command: `${BIN} statusline`, padding: 0 },
        hooks: {
          Stop: [
            { hooks: [{ type: "command", command: `${BIN} hook stop` }] },
            { hooks: [{ type: "command", command: "/usr/local/bin/other-tool stop" }] },
          ],
        },
      })
    )

    const { restoreOrStripHooks } = await import("../uninstall.js")
    const res = await restoreOrStripHooks()

    const after = JSON.parse(readFileSync(settingsPath, "utf8")) as Record<string, unknown>
    expect(res.stripped).toBe(true)
    // the user's own settings survive
    expect(after["model"]).toBe("some-model")
    expect(after["theme"]).toBe("dark")
    expect(after["enabledPlugins"]).toEqual({ a: true, b: true })
    // ours are gone, other tools' hooks stay
    expect(JSON.stringify(after)).not.toContain(BIN)
    expect(JSON.stringify(after)).toContain("other-tool")
    // the stale snapshot is cleaned up
    expect(existsSync(backupPath)).toBe(false)
  })
})
