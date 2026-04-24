import { describe, expect, it } from "vitest"
import { compareSemver, maybeCheck } from "../upgrade-check.js"

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

describe("maybeCheck", () => {
  it("passive timeout returns null on network error", async () => {
    const result = await maybeCheck("1.0.0", {
      force: true,
      timeoutMs: 10,
      fetchLatest: (signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(new Error("aborted")))
          // never resolve — rely on the abort to settle
        }),
      now: () => 0,
    })
    expect(result).toBeNull()
  })

  it("reports outdated when fetch returns a newer version", async () => {
    const result = await maybeCheck("0.1.0", {
      force: true,
      fetchLatest: async () => "0.2.0",
      now: () => 0,
    })
    // writeCache may fail in an empty home dir; just assert shape
    expect(result?.latest).toBe("0.2.0")
    expect(result?.outdated).toBe(true)
    expect(result?.cached).toBe(false)
  })

  it("reports up-to-date when versions match", async () => {
    const result = await maybeCheck("0.2.0", {
      force: true,
      fetchLatest: async () => "0.2.0",
      now: () => 0,
    })
    expect(result?.outdated).toBe(false)
  })

  it("throws on non-timeout failure when timeoutMs is undefined", async () => {
    await expect(
      maybeCheck("0.1.0", {
        force: true,
        fetchLatest: async () => {
          throw new Error("boom")
        },
        now: () => 0,
      })
    ).rejects.toThrow(/boom/)
  })
})
