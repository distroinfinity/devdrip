import { describe, it, expect, vi, beforeEach } from "vitest"

const apiFetchMock = vi.fn()
vi.mock("../api-client.js", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  apiFetchPublic: (...args: unknown[]) => apiFetchMock(...args),
  resolveApiUrl: () => "http://localhost:3000",
}))

const readSettingsMock = vi.fn()
vi.mock("../claude-settings.js", () => ({
  readSettings: (...args: unknown[]) => readSettingsMock(...args),
  getMissingDevdripHookEvents: (
    settings: {
      hooks?: Record<string, Array<{ hooks?: Array<{ command?: string }> }>>
    },
    binPath: string
  ) => {
    const required = [
      ["PreToolUse", "pre-tool"],
      ["Stop", "stop"],
      ["UserPromptSubmit", "prompt-submit"],
    ] as const

    return required
      .filter(([event, sub]) => {
        const groups = settings.hooks?.[event] ?? []
        return !groups.some((group) =>
          (group.hooks ?? []).some((hook) => hook.command === `${binPath} hook ${sub}`)
        )
      })
      .map(([event]) => event)
  },
}))

import { runInitHealthCheck } from "../health.js"
import type { DevdripConfig } from "../config.js"
import { defaultDevdripPreferences } from "@devdrip/shared"

const cfg: DevdripConfig = {
  version: 3,
  apiUrl: "http://localhost:3000",
  auth: { accessToken: "a", refreshToken: "b", accessTokenExpiresAt: "2099-01-01T00:00:00Z" },
  user: { id: "u", githubLogin: "gh", email: "e@x.com", avatarUrl: null },
  device: { id: "dev-1" },
  cli: { binPath: "/abs/devdrip" },
  preferences: defaultDevdripPreferences(),
}

beforeEach(() => {
  apiFetchMock.mockReset()
  readSettingsMock.mockReset()
})

describe("runInitHealthCheck", () => {
  it("returns four ok probes when everything is healthy", async () => {
    apiFetchMock.mockResolvedValue({ ok: true })
    readSettingsMock.mockResolvedValue({
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: "/abs/devdrip hook pre-tool" }] }],
        Stop: [{ hooks: [{ type: "command", command: "/abs/devdrip hook stop" }] }],
        UserPromptSubmit: [
          { hooks: [{ type: "command", command: "/abs/devdrip hook prompt-submit" }] },
        ],
      },
    })

    const probes = await runInitHealthCheck(cfg, "/fake/settings.json")
    expect(probes).toHaveLength(4)
    expect(probes.every((p) => p.ok)).toBe(true)
    expect(probes.map((p) => p.name)).toEqual([
      "auth valid (GET /me)",
      "device registered",
      "hooks installed in ~/.claude/settings.json",
      "backend reachable (GET /health)",
    ])
  })

  it("marks device probe as failed when cfg.device.id is null", async () => {
    apiFetchMock.mockResolvedValue({ ok: true })
    readSettingsMock.mockResolvedValue({
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: "/abs/devdrip hook pre-tool" }] }],
        Stop: [{ hooks: [{ type: "command", command: "/abs/devdrip hook stop" }] }],
        UserPromptSubmit: [
          { hooks: [{ type: "command", command: "/abs/devdrip hook prompt-submit" }] },
        ],
      },
    })

    const probes = await runInitHealthCheck({ ...cfg, device: { id: null } }, "/fake/settings.json")
    const device = probes.find((p) => p.name === "device registered")
    expect(device?.ok).toBe(false)
  })

  it("marks hooks probe as failed when one expected hook event is missing", async () => {
    apiFetchMock.mockResolvedValue({ ok: true })
    readSettingsMock.mockResolvedValue({
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: "/abs/devdrip hook pre-tool" }] }],
      },
    })
    const probes = await runInitHealthCheck(cfg, "/fake/settings.json")
    const hooks = probes.find((p) => p.name.startsWith("hooks installed"))
    expect(hooks?.ok).toBe(false)
    expect(hooks?.detail).toContain("Stop")
    expect(hooks?.detail).toContain("UserPromptSubmit")
  })

  it("marks auth probe as failed when GET /me throws", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/me") throw new Error("unauthorized")
      return { ok: true }
    })
    readSettingsMock.mockResolvedValue({
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: "/abs/devdrip hook pre-tool" }] }],
        Stop: [{ hooks: [{ type: "command", command: "/abs/devdrip hook stop" }] }],
        UserPromptSubmit: [
          { hooks: [{ type: "command", command: "/abs/devdrip hook prompt-submit" }] },
        ],
      },
    })
    const probes = await runInitHealthCheck(cfg, "/fake/settings.json")
    const auth = probes.find((p) => p.name.startsWith("auth valid"))
    expect(auth?.ok).toBe(false)
  })
})
