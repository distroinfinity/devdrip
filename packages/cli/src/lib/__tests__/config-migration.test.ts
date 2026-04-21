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
  it("reads a v1 config and returns a v2 shape with default device/cli fields", async () => {
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
    expect(cfg?.version).toBe(2)
    expect(cfg?.device).toEqual({ id: null })
    expect(cfg?.cli).toEqual({ binPath: "" })
    expect(cfg?.user.githubLogin).toBe("gh")
  })

  it("reads a v2 config unchanged", async () => {
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
    expect(cfg?.device?.id).toBe("dev-1")
    expect(cfg?.cli?.binPath).toBe("/usr/local/bin/devdrip")
  })

  it("returns null for a v0 or future-version config", async () => {
    const dir = join(tempHome, ".devdrip")
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "config.json"), JSON.stringify({ version: 99, apiUrl: "x" }))
    const { readConfig } = await import("../config.js")
    const cfg = await readConfig()
    expect(cfg).toBeNull()
  })
})
