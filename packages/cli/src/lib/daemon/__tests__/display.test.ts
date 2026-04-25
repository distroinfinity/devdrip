import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import type fs from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { CachedAd } from "../../ad-cache.js"
import { showAd } from "../display.js"

const sampleAd: CachedAd = {
  id: "ad-1",
  campaignId: "camp-1",
  format: "text",
  headline: "Hello world",
  body: "Some body text",
  url: "https://example.com/x",
  displayTimeMs: 8000,
  deliveryToken: "tok",
  impressionBeaconUrl: undefined,
  clickTrackingUrl: undefined,
  cacheSource: "api",
}

let tempDir = ""

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "devdrip-display-"))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe("showAd", () => {
  it("writes the renderBox output followed by a newline", () => {
    const target = join(tempDir, "tty")
    const handle = showAd(target, sampleAd)
    handle.vanish()
    const content = readFileSync(target, "utf8")
    expect(content).toContain("Hello world")
    expect(content).toContain("Some body text")
    // followed by a newline and the vanish sequence
    expect(content).toMatch(/\n\x1b\[\d+A\x1b\[0J$/)
  })

  it("vanish cursor-up count matches the rendered line count", () => {
    const target = join(tempDir, "tty")
    const handle = showAd(target, sampleAd)
    handle.vanish()
    const content = readFileSync(target, "utf8")
    // content is: <boxText>\n<ESC>[N A<ESC>[0J
    const match = content.match(/\n\x1b\[(\d+)A\x1b\[0J$/)
    expect(match).not.toBeNull()
    if (!match || !match[1]) throw new Error("match should contain captured digits")
    const reportedLines = parseInt(match[1], 10)
    const bodyLines = content.slice(0, content.length - match[0].length).split("\n").length // includes the trailing newline as an empty segment
    expect(reportedLines).toBe(bodyLines)
  })

  it("vanish is idempotent (second call is a no-op, no throw)", () => {
    const target = join(tempDir, "tty")
    const handle = showAd(target, sampleAd)
    handle.vanish()
    expect(() => handle.vanish()).not.toThrow()
  })

  it("tolerates a missing tty path by throwing in showAd (caller handles)", () => {
    const missing = join(tempDir, "does-not-exist", "tty")
    expect(() => showAd(missing, sampleAd)).toThrow()
  })

  it("closes the fd if writeSync throws after a successful openSync", async () => {
    // isolate module registry so the mocked fs doesn't leak to other tests
    vi.resetModules()
    const target = join(tempDir, "tty")
    const closeCalls: number[] = []
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<typeof fs>("node:fs")
      return {
        ...actual,
        openSync: vi.fn(() => 4242),
        writeSync: vi.fn(() => {
          throw new Error("EPIPE: simulated")
        }),
        closeSync: vi.fn((fd: number) => {
          closeCalls.push(fd)
        }),
      }
    })
    try {
      const { showAd: showAdMocked } = await import("../display.js")
      expect(() => showAdMocked(target, sampleAd)).toThrow("EPIPE")
      expect(closeCalls).toEqual([4242])
    } finally {
      vi.doUnmock("node:fs")
      vi.resetModules()
    }
  })
})
