import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

let tempHome: string

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "devdrip-test-"))
  process.env["HOME"] = tempHome
})

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true })
})

describe("config migration", () => {
  it("reads a v1 config and upgrades to v3 with default device/cli/preferences", async () => {
    const dir = join(tempHome, ".devdrip")
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, "config.json"),
      JSON.stringify({
        version: 1,
        apiUrl: "http://localhost:3000",
        auth: { accessToken: "a", refreshToken: "b", accessTokenExpiresAt: "2099-01-01T00:00:00Z" },
        user: { id: "u1", githubLogin: "gh", email: "e@x.com", avatarUrl: null },
      })
    )

    const { readConfig } = await import("../config.js")
    const cfg = await readConfig()

    expect(cfg).not.toBeNull()
    expect(cfg?.version).toBe(4)
    expect(cfg?.device).toEqual({ id: null })
    expect(cfg?.cli).toEqual({ binPath: "" })
    expect(cfg?.user.githubLogin).toBe("gh")
    expect(cfg?.preferences.maxPerHour).toBeGreaterThan(0)
    expect(cfg?.preferences.blockedCategories).toEqual([])
    expect(cfg?.preferences.nightMode).toBe(false)
  })

  it("reads a v2 config and upgrades to v3 preserving device/cli, filling default prefs", async () => {
    const dir = join(tempHome, ".devdrip")
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, "config.json"),
      JSON.stringify({
        version: 2,
        apiUrl: "http://localhost:3000",
        auth: { accessToken: "a", refreshToken: "b", accessTokenExpiresAt: "2099-01-01T00:00:00Z" },
        user: { id: "u1", githubLogin: "gh", email: "e@x.com", avatarUrl: null },
        device: { id: "dev-1" },
        cli: { binPath: "/usr/local/bin/devdrip" },
      })
    )

    const { readConfig } = await import("../config.js")
    const cfg = await readConfig()
    expect(cfg?.version).toBe(4)
    expect(cfg?.device?.id).toBe("dev-1")
    expect(cfg?.cli?.binPath).toBe("/usr/local/bin/devdrip")
    expect(cfg?.preferences.blockedCategories).toEqual([])
    expect(cfg?.preferences.quietHoursStart).toBeNull()
  })

  it("reads a v3 config unchanged (round-trip)", async () => {
    const dir = join(tempHome, ".devdrip")
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, "config.json"),
      JSON.stringify({
        version: 3,
        apiUrl: "http://localhost:3000",
        auth: { accessToken: "a", refreshToken: "b", accessTokenExpiresAt: "2099-01-01T00:00:00Z" },
        user: { id: "u1", githubLogin: "gh", email: "e@x.com", avatarUrl: null },
        device: { id: "dev-1" },
        cli: { binPath: "/usr/local/bin/devdrip" },
        preferences: {
          blockedCategories: ["databases"],
          maxPerHour: 3,
          maxPerDay: 30,
          sessionWarmupMs: 120000,
          quietHoursStart: 22,
          quietHoursEnd: 7,
          nightMode: true,
          tzOffsetMinutes: 330,
        },
      })
    )

    const { readConfig } = await import("../config.js")
    const cfg = await readConfig()
    expect(cfg?.preferences.maxPerHour).toBe(3)
    expect(cfg?.preferences.blockedCategories).toEqual(["databases"])
    expect(cfg?.preferences.nightMode).toBe(true)
  })

  it("throws for unknown versions", async () => {
    const dir = join(tempHome, ".devdrip")
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "config.json"), JSON.stringify({ version: 99, apiUrl: "x" }))
    const { readConfig } = await import("../config.js")
    await expect(readConfig()).rejects.toThrow(/unsupported config version 99/)
  })

  it("writeConfig stamps version=3 and fills default preferences when omitted", async () => {
    const { writeConfig, readConfig } = await import("../config.js")
    await writeConfig({
      apiUrl: "http://localhost:3000",
      auth: { accessToken: "a", refreshToken: "b", accessTokenExpiresAt: "2099-01-01T00:00:00Z" },
      user: { id: "u1", githubLogin: "gh", email: "e@x.com", avatarUrl: null },
      device: { id: null },
      cli: { binPath: "" },
    })
    const cfg = await readConfig()
    expect(cfg?.version).toBe(4)
    expect(cfg?.preferences.blockedCategories).toEqual([])
  })
})
