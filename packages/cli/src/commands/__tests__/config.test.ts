import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AdCategory } from "@devdrip/shared"

let tempHome: string

const apiFetchMock = vi.fn()
vi.mock("../../lib/api-client.js", async () => ({
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
}))

const sendHookEventMock = vi.fn().mockResolvedValue(undefined)
vi.mock("../../lib/daemon/hook-client.js", () => ({
  sendHookEvent: (...args: unknown[]) => sendHookEventMock(...args),
  CONNECT_TIMEOUT_MS: 50,
}))

const multiselectMock = vi.fn()
const selectMock = vi.fn()
const textMock = vi.fn()
const confirmMock = vi.fn()
vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  cancel: vi.fn(),
  isCancel: () => false,
  multiselect: (...args: unknown[]) => multiselectMock(...args),
  select: (...args: unknown[]) => selectMock(...args),
  text: (...args: unknown[]) => textMock(...args),
  confirm: (...args: unknown[]) => confirmMock(...args),
  log: {
    step: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

function seedV3Config(home: string, overrides: Record<string, unknown> = {}): void {
  mkdirSync(join(home, ".devdrip"), { recursive: true, mode: 0o700 })
  writeFileSync(
    join(home, ".devdrip", "config.json"),
    JSON.stringify({
      version: 3,
      apiUrl: "http://localhost:3000",
      auth: { accessToken: "a", refreshToken: "b", accessTokenExpiresAt: "2099-01-01T00:00:00Z" },
      user: { id: "u1", githubLogin: "gh", email: "e@x.com", avatarUrl: null },
      device: { id: "dev-1" },
      cli: { binPath: "/usr/local/bin/devdrip" },
      preferences: {
        blockedCategories: [],
        maxPerHour: 8,
        maxPerDay: 60,
        sessionWarmupMs: 600_000,
        quietHoursStart: null,
        quietHoursEnd: null,
        nightMode: false,
        tzOffsetMinutes: 0,
        ...overrides,
      },
    }),
    { mode: 0o600 }
  )
}

function readPersistedPrefs(home: string): Record<string, unknown> {
  const raw = readFileSync(join(home, ".devdrip", "config.json"), "utf8")
  const cfg = JSON.parse(raw) as { preferences: Record<string, unknown> }
  return cfg.preferences
}

async function runConfig(args: string[]): Promise<void> {
  // re-import each time so the mocked modules are fresh
  const { configCmd } = await import("../config.js")
  // without exitOverride, commander calls process.exit(1) when the action
  // rejects — which our vitest harness converts into an opaque error. Make
  // the command throw instead so we can assert on the underlying message.
  configCmd.exitOverride()
  // `from: "user"` tells commander the argv array contains only user args
  // (no node binary / script path prefix).
  await configCmd.parseAsync(args, { from: "user" })
}

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "devdrip-config-"))
  process.env["HOME"] = tempHome
  apiFetchMock.mockReset().mockResolvedValue({ preferences: {} })
  sendHookEventMock.mockReset().mockResolvedValue(undefined)
  multiselectMock.mockReset()
  selectMock.mockReset()
  textMock.mockReset()
  confirmMock.mockReset()
  vi.resetModules()
})

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true })
})

describe("devdrip config --list", () => {
  it("prints current preferences as JSON", async () => {
    seedV3Config(tempHome)
    const logs: string[] = []
    const spy = vi.spyOn(console, "log").mockImplementation((s: string) => {
      logs.push(s)
    })
    await runConfig(["--list"])
    spy.mockRestore()
    const parsed = JSON.parse(logs.join("\n")) as Record<string, unknown>
    expect(parsed["maxPerHour"]).toBe(8)
    expect(parsed["blockedCategories"]).toEqual([])
  })
})

describe("devdrip config --get", () => {
  it("prints a single key", async () => {
    seedV3Config(tempHome, { maxPerHour: 3 })
    const logs: string[] = []
    const spy = vi.spyOn(console, "log").mockImplementation((s: string) => {
      logs.push(s)
    })
    await runConfig(["--get", "maxPerHour"])
    spy.mockRestore()
    expect(logs.join("\n").trim()).toBe("3")
  })

  it("rejects unknown keys", async () => {
    seedV3Config(tempHome)
    await expect(runConfig(["--get", "foo"])).rejects.toThrow(/unknown key/)
  })
})

describe("devdrip config --set", () => {
  it("persists a single numeric update and fires reload-config IPC", async () => {
    seedV3Config(tempHome)
    await runConfig(["--set", "maxPerHour=4"])
    const prefs = readPersistedPrefs(tempHome)
    expect(prefs["maxPerHour"]).toBe(4)
    expect(sendHookEventMock).toHaveBeenCalledWith({ type: "reload-config" }, expect.any(String))
  })

  it("accepts multiple --set pairs in one invocation", async () => {
    seedV3Config(tempHome)
    await runConfig(["--set", "maxPerHour=2", "--set", "nightMode=true"])
    const prefs = readPersistedPrefs(tempHome)
    expect(prefs["maxPerHour"]).toBe(2)
    expect(prefs["nightMode"]).toBe(true)
  })

  it("updates categories and pushes the change to the backend", async () => {
    seedV3Config(tempHome)
    await runConfig(["--set", "blockedCategories=databases,developer-recruiting"])
    const prefs = readPersistedPrefs(tempHome)
    expect(prefs["blockedCategories"]).toEqual(["databases", "developer-recruiting"])

    const putCall = apiFetchMock.mock.calls.find(
      ([path, init]) => path === "/me/preferences" && (init as { method?: string }).method === "PUT"
    )
    expect(putCall).toBeDefined()
    const body = (putCall?.[1] as { body: { blockedCategories: string[] } }).body
    expect(body.blockedCategories).toEqual(["databases", "developer-recruiting"])
  })

  it("does not hit the backend when only non-category fields change", async () => {
    seedV3Config(tempHome)
    await runConfig(["--set", "maxPerDay=10"])
    const putCall = apiFetchMock.mock.calls.find(
      ([path, init]) => path === "/me/preferences" && (init as { method?: string }).method === "PUT"
    )
    expect(putCall).toBeUndefined()
  })

  it("rejects non-integer numeric values", async () => {
    seedV3Config(tempHome)
    await expect(runConfig(["--set", "maxPerHour=notANumber"])).rejects.toThrow(
      /maxPerHour: expected integer/
    )
  })

  it("rejects unknown categories", async () => {
    seedV3Config(tempHome)
    await expect(runConfig(["--set", "blockedCategories=not-a-real-category"])).rejects.toThrow(
      /unknown category/
    )
  })

  it("rejects unknown keys", async () => {
    seedV3Config(tempHome)
    await expect(runConfig(["--set", "somethingElse=1"])).rejects.toThrow(/unknown key/)
  })

  it("accepts 'off' as quietHoursStart to clear the value", async () => {
    seedV3Config(tempHome, { quietHoursStart: 22, quietHoursEnd: 7 })
    await runConfig(["--set", "quietHoursStart=off"])
    const prefs = readPersistedPrefs(tempHome)
    expect(prefs["quietHoursStart"]).toBeNull()
    expect(prefs["quietHoursEnd"]).toBe(7)
  })
})

describe("devdrip config --reset", () => {
  it("restores default preferences and notifies the daemon", async () => {
    seedV3Config(tempHome, {
      maxPerHour: 2,
      maxPerDay: 10,
      nightMode: true,
      blockedCategories: [AdCategory.Databases],
    })
    await runConfig(["--reset"])
    const prefs = readPersistedPrefs(tempHome)
    expect(prefs["maxPerHour"]).toBe(8)
    expect(prefs["maxPerDay"]).toBe(60)
    expect(prefs["nightMode"]).toBe(false)
    expect(prefs["blockedCategories"]).toEqual([])
    expect(sendHookEventMock).toHaveBeenCalled()
  })
})

describe("devdrip config (no config)", () => {
  it("errors clearly when ~/.devdrip/config.json does not exist", async () => {
    await expect(runConfig(["--list"])).rejects.toThrow(/not initialized/)
  })
})
