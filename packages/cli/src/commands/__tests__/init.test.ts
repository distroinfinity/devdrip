// packages/cli/src/commands/__tests__/init.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AdCategory } from "@devdrip/shared"

let tempHome: string
let origArgv1: string | undefined

const apiFetchMock = vi.fn()
vi.mock("../../lib/api-client.js", async () => {
  return {
    apiFetch: (...args: unknown[]) => apiFetchMock(...args),
    apiFetchPublic: (...args: unknown[]) => apiFetchMock(...args),
    resolveApiUrl: () => "http://localhost:3000",
    ApiError: class ApiError extends Error {
      constructor(
        public status: number,
        public code: string
      ) {
        super(code)
      }
    },
    NotAuthenticatedError: class NotAuthenticatedError extends Error {},
    reportError: (err: unknown) => {
      throw err
    },
  }
})

vi.mock("../../lib/device.js", async () => ({
  registerDevice: vi.fn().mockResolvedValue({
    id: "00000000-1111-2222-3333-444444444444",
    userId: "u1",
    deviceName: "host",
    os: "darwin",
    ideType: "terminal",
    lastHeartbeat: null,
    createdAt: "2026-04-21T00:00:00Z",
  }),
}))

const multiselectMock = vi.fn()
vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  cancel: vi.fn(),
  isCancel: () => false,
  multiselect: (...args: unknown[]) => multiselectMock(...args),
}))

// runLogin is only reached when no config exists — for these tests we pre-seed a config
vi.mock("../auth.js", () => ({
  runLogin: vi.fn().mockImplementation(async () => {
    throw new Error("runLogin should not be called when config already exists")
  }),
}))

vi.mock("../demo.js", () => ({
  runDemo: vi.fn().mockResolvedValue(undefined),
  demoCmd: {},
}))

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "devdrip-init-"))
  process.env["HOME"] = tempHome
  // make resolveBinPath() produce a devdrip-named path so DEVDRIP_SUB_RE matches
  origArgv1 = process.argv[1]
  process.argv[1] = "/usr/local/bin/devdrip"
  // seed a v2 config so auth step is a no-op
  mkdirSync(join(tempHome, ".devdrip"), { recursive: true, mode: 0o700 })
  writeFileSync(
    join(tempHome, ".devdrip", "config.json"),
    JSON.stringify({
      version: 2,
      apiUrl: "http://localhost:3000",
      auth: { accessToken: "a", refreshToken: "b", accessTokenExpiresAt: "2099-01-01T00:00:00Z" },
      user: { id: "u1", githubLogin: "gh", email: "e@x.com", avatarUrl: null },
      device: { id: null },
      cli: { binPath: "" },
    }),
    { mode: 0o600 }
  )
  // create ~/.claude so the Claude Code check passes
  mkdirSync(join(tempHome, ".claude"), { recursive: true })

  apiFetchMock.mockReset().mockImplementation(async (path: string) => {
    if (path === "/me") return { id: "u1", githubLogin: "gh", email: "e@x.com", avatarUrl: null }
    if (path === "/health") return { ok: true }
    if (path === "/me/preferences") return { preferences: {} }
    return {}
  })
  multiselectMock.mockReset().mockResolvedValue([
    AdCategory.CloudInfrastructure,
    AdCategory.DeveloperTools,
    AdCategory.Databases,
    AdCategory.MonitoringObservability,
    AdCategory.DeveloperEducation,
    AdCategory.SaasProducts,
    // user un-checked DeveloperRecruiting
  ])
})

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true })
  if (origArgv1 !== undefined) process.argv[1] = origArgv1
})

describe("devdrip init", () => {
  it("writes hooks, backup, updates config with device.id + binPath, PUTs preferences", async () => {
    const { runInit } = await import("../init.js")
    await runInit()

    // settings.json contains all three events with our bin path
    const settings = JSON.parse(
      readFileSync(join(tempHome, ".claude", "settings.json"), "utf8")
    ) as { hooks: { [k: string]: Array<{ hooks: Array<{ command: string }> }> } }
    expect(settings.hooks.PreToolUse?.[0]?.hooks[0]?.command).toMatch(/hook pre-tool$/)
    expect(settings.hooks.Stop?.[0]?.hooks[0]?.command).toMatch(/hook stop$/)
    expect(settings.hooks.UserPromptSubmit?.[0]?.hooks[0]?.command).toMatch(/hook prompt-submit$/)

    // backup written
    expect(existsSync(join(tempHome, ".claude", "settings.json.devdrip-backup"))).toBe(true)

    // config updated with device.id and a non-empty binPath
    const cfgRaw = readFileSync(join(tempHome, ".devdrip", "config.json"), "utf8")
    const cfg = JSON.parse(cfgRaw) as {
      device: { id: string | null }
      cli: { binPath: string }
    }
    expect(cfg.device.id).toBe("00000000-1111-2222-3333-444444444444")
    expect(cfg.cli.binPath.length).toBeGreaterThan(0)

    // preferences PUT body
    const putCall = apiFetchMock.mock.calls.find(
      ([path, init]) => path === "/me/preferences" && (init as { method?: string }).method === "PUT"
    )
    expect(putCall).toBeDefined()
    const putBody = (putCall?.[1] as { body: { blockedCategories: string[] } }).body
    expect(putBody.blockedCategories).toEqual([AdCategory.DeveloperRecruiting])
  })

  it("is idempotent on second run — no duplicate hook groups", async () => {
    const { runInit } = await import("../init.js")
    await runInit()
    await runInit()

    const settings = JSON.parse(
      readFileSync(join(tempHome, ".claude", "settings.json"), "utf8")
    ) as { hooks: { [k: string]: unknown[] } }
    expect(settings.hooks.PreToolUse).toHaveLength(1)
    expect(settings.hooks.Stop).toHaveLength(1)
    expect(settings.hooks.UserPromptSubmit).toHaveLength(1)
  })

  it("preserves a pre-existing backup untouched on re-run", async () => {
    const settingsPath = join(tempHome, ".claude", "settings.json")
    const backupPath = `${settingsPath}.devdrip-backup`
    writeFileSync(
      settingsPath,
      '{"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"/other/tool foo"}]}]}}'
    )

    const { runInit } = await import("../init.js")
    await runInit()

    expect(readFileSync(backupPath, "utf8")).toContain("/other/tool foo")

    // second run must not overwrite backup even if settings changes
    writeFileSync(settingsPath, '{"hooks":{}}')
    await runInit()
    expect(readFileSync(backupPath, "utf8")).toContain("/other/tool foo")
  })
})
