import { describe, expect, it, vi } from "vitest"
import { checkForUpdate, compareSemver } from "../upgrade-check.js"

vi.mock("../api-client.js", () => ({
  apiFetchPublic: vi.fn(),
}))

import { apiFetchPublic } from "../api-client.js"
const mockApiFetch = vi.mocked(apiFetchPublic)

describe("compareSemver", () => {
  it.each([
    ["1.0.0", "1.0.0", 0],
    ["1.0.0", "1.0.1", -1],
    ["1.0.1", "1.0.0", 1],
    ["0.9.9", "1.0.0", -1],
    ["1.2.10", "1.2.9", 1],
    ["1.2.3", "1.10.0", -1],
    ["0.0.0", "0.1.0", -1],
    ["2.0.0", "2.0.0-beta.1", 1],
    ["2.0.0-beta.1", "2.0.0", -1],
    ["2.0.0-beta.1", "2.0.0-beta.2", -1],
    ["2.0.0-alpha", "2.0.0-beta", -1],
  ] as const)("%s vs %s → %d", (a, b, expected) => {
    expect(compareSemver(a, b)).toBe(expected)
  })
})

describe("checkForUpdate", () => {
  it("returns server payload when outdated", async () => {
    mockApiFetch.mockResolvedValueOnce({
      latest: "0.2.0",
      outdated: true,
      tarballUrl: "https://example.com/distrotv-cli.tar.gz",
    })
    const result = await checkForUpdate("0.1.0")
    expect(result?.latest).toBe("0.2.0")
    expect(result?.outdated).toBe(true)
    expect(result?.tarballUrl).toBe("https://example.com/distrotv-cli.tar.gz")
    expect(mockApiFetch).toHaveBeenCalledWith("/cli/version-check", {
      query: { current: "0.1.0" },
      timeoutMs: undefined,
    })
  })

  it("returns server payload when up to date", async () => {
    mockApiFetch.mockResolvedValueOnce({
      latest: "0.2.0",
      outdated: false,
      tarballUrl: "",
    })
    const result = await checkForUpdate("0.2.0")
    expect(result?.outdated).toBe(false)
    expect(result?.tarballUrl).toBe("")
  })

  it("returns null on network failure", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("network error"))
    const result = await checkForUpdate("0.1.0")
    expect(result).toBeNull()
  })

  it("passes timeoutMs to apiFetchPublic", async () => {
    mockApiFetch.mockResolvedValueOnce({
      latest: "0.1.0",
      outdated: false,
      tarballUrl: "",
    })
    await checkForUpdate("0.1.0", { timeoutMs: 500 })
    expect(mockApiFetch).toHaveBeenCalledWith("/cli/version-check", {
      query: { current: "0.1.0" },
      timeoutMs: 500,
    })
  })
})
