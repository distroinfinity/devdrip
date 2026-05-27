import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync, mkdirSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  verifyStaged,
  activate,
  rollback,
  pruneOldVersions,
  markVersionBad,
  isVersionBad,
} from "../auto-update.js"
import {
  swapCurrent,
  writeUpdateState,
  readActiveVersion,
  readUpdateState,
  versionDir,
} from "../install-layout.js"

// ── Task 6: verifyStaged ─────────────────────────────────────────────────────

function fakeExec(map: Record<string, { code: number; stdout: string }>) {
  return async (_node: string, args: string[]) => {
    const key = args.includes("--version") ? "version" : "self-check"
    return map[key] ?? { code: 1, stdout: "" }
  }
}

describe("verifyStaged", () => {
  it("passes when --version matches and self-check exits 0", async () => {
    const ok = await verifyStaged("/staged", "0.2.11", {
      exec: fakeExec({
        version: { code: 0, stdout: "0.2.11\n" },
        "self-check": { code: 0, stdout: "" },
      }),
    })
    expect(ok).toBe(true)
  })
  it("fails when --version mismatches", async () => {
    const ok = await verifyStaged("/staged", "0.2.11", {
      exec: fakeExec({
        version: { code: 0, stdout: "0.2.10\n" },
        "self-check": { code: 0, stdout: "" },
      }),
    })
    expect(ok).toBe(false)
  })
  it("fails when self-check exits non-zero", async () => {
    const ok = await verifyStaged("/staged", "0.2.11", {
      exec: fakeExec({
        version: { code: 0, stdout: "0.2.11\n" },
        "self-check": { code: 1, stdout: "" },
      }),
    })
    expect(ok).toBe(false)
  })
})

// ── Task 7: pipeline ─────────────────────────────────────────────────────────

let home: string
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "dtv-"))
  process.env.DISTROTV_HOME = home
})
afterEach(() => {
  delete process.env.DISTROTV_HOME
  rmSync(home, { recursive: true, force: true })
})

describe("pipeline", () => {
  it("activate moves staged into versions/<v>, swaps current, writes probation", () => {
    mkdirSync(versionDir("0.2.10"), { recursive: true })
    swapCurrent("0.2.10")
    const staged = mkdtempSync(join(tmpdir(), "stage-"))
    mkdirSync(join(staged, "dist"), { recursive: true })
    activate(staged, "0.2.11", () => 7)
    expect(readActiveVersion()).toBe("0.2.11")
    expect(readUpdateState()).toMatchObject({
      phase: "probation",
      previousVersion: "0.2.10",
      newVersion: "0.2.11",
      swappedAt: 7,
    })
  })
  it("rollback reverts current to previous and marks the new version bad", () => {
    mkdirSync(versionDir("0.2.10"), { recursive: true })
    mkdirSync(versionDir("0.2.11"), { recursive: true })
    swapCurrent("0.2.11")
    writeUpdateState({
      phase: "probation",
      previousVersion: "0.2.10",
      newVersion: "0.2.11",
      swappedAt: 1,
    })
    rollback()
    expect(readActiveVersion()).toBe("0.2.10")
    expect(isVersionBad("0.2.11")).toBe(true)
    expect(readUpdateState()?.phase).toBe("rolled-back")
  })
  it("pruneOldVersions keeps the active + last N", () => {
    for (const v of ["0.2.8", "0.2.9", "0.2.10"]) {
      mkdirSync(versionDir(v), { recursive: true })
    }
    swapCurrent("0.2.10")
    pruneOldVersions(1)
    expect(existsSync(versionDir("0.2.10"))).toBe(true)
    expect(existsSync(versionDir("0.2.9"))).toBe(true)
    expect(existsSync(versionDir("0.2.8"))).toBe(false)
  })
  it("bad-version backoff records and reports", () => {
    expect(isVersionBad("0.2.11")).toBe(false)
    markVersionBad("0.2.11")
    expect(isVersionBad("0.2.11")).toBe(true)
  })
})
