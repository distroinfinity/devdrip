import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync, mkdirSync, symlinkSync, writeFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  distrotvHome,
  versionsDir,
  currentLink,
  versionDir,
  currentEntryPath,
  readActiveVersion,
  readUpdateState,
  writeUpdateState,
  swapCurrent,
  migrateFlatInstall,
} from "../install-layout.js"

let home: string
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "dtv-"))
  process.env.DISTROTV_HOME = home
})
afterEach(() => {
  delete process.env.DISTROTV_HOME
  rmSync(home, { recursive: true, force: true })
})

describe("install-layout", () => {
  it("derives versioned paths from DISTROTV_HOME", () => {
    expect(distrotvHome()).toBe(home)
    expect(versionsDir()).toBe(join(home, "versions"))
    expect(currentLink()).toBe(join(home, "current"))
    expect(versionDir("0.2.11")).toBe(join(home, "versions", "0.2.11"))
    expect(currentEntryPath()).toBe(join(home, "current", "dist", "index.js"))
  })

  it("readActiveVersion returns the current symlink target basename, or null", () => {
    expect(readActiveVersion()).toBeNull()
    mkdirSync(versionDir("0.2.11"), { recursive: true })
    symlinkSync(versionDir("0.2.11"), currentLink())
    expect(readActiveVersion()).toBe("0.2.11")
  })

  it("round-trips update-state", () => {
    expect(readUpdateState()).toBeNull()
    writeUpdateState({
      phase: "probation",
      previousVersion: "0.2.10",
      newVersion: "0.2.11",
      swappedAt: 5,
    })
    expect(readUpdateState()).toEqual({
      phase: "probation",
      previousVersion: "0.2.10",
      newVersion: "0.2.11",
      swappedAt: 5,
    })
  })

  it("swapCurrent atomically repoints current and is idempotent", () => {
    mkdirSync(versionDir("0.2.10"), { recursive: true })
    mkdirSync(versionDir("0.2.11"), { recursive: true })
    swapCurrent("0.2.10")
    expect(readActiveVersion()).toBe("0.2.10")
    swapCurrent("0.2.11")
    expect(readActiveVersion()).toBe("0.2.11")
  })

  it("migrates a legacy flat install into versions/<v> + current", () => {
    mkdirSync(join(home, "dist"), { recursive: true })
    writeFileSync(join(home, "dist", "index.js"), "// app")
    mkdirSync(join(home, "node_modules"), { recursive: true })
    migrateFlatInstall("0.2.9")
    expect(readActiveVersion()).toBe("0.2.9")
    expect(existsSync(join(versionDir("0.2.9"), "dist", "index.js"))).toBe(true)
    expect(existsSync(join(home, "dist"))).toBe(false)
    migrateFlatInstall("0.2.9") // idempotent
    expect(readActiveVersion()).toBe("0.2.9")
  })
})
