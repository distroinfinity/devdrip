import { describe, it, expect, vi } from "vitest"
import fs from "node:fs"

describe("display — writeWithRetry", () => {
  it("retries on EAGAIN up to 3 times then throws", async () => {
    const eagain: NodeJS.ErrnoException = Object.assign(new Error("eagain"), { code: "EAGAIN" })
    const spy = vi.spyOn(fs, "writeSync").mockImplementation(() => {
      throw eagain
    })

    const { writeWithRetry } = await import("../display.js")
    expect(() => writeWithRetry(99, "x")).toThrow(/eagain/i)
    expect(spy).toHaveBeenCalledTimes(3)
    spy.mockRestore()
  })

  it("returns after first successful writeSync", async () => {
    const spy = vi.spyOn(fs, "writeSync").mockReturnValue(1)
    const { writeWithRetry } = await import("../display.js")
    writeWithRetry(99, "x")
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})

const ad = {
  id: "ad-1",
  campaignId: "camp-1",
  format: "text" as const,
  headline: "H",
  url: "https://x.test",
  displayTimeMs: 8000,
  cpmRate: 5,
  deliveryToken: "tok",
  cacheSource: "api" as const,
}

describe("showAd — fd safety", () => {
  it("vanish is idempotent — second call is a no-op and closeSync fires only once", async () => {
    const openSpy = vi.spyOn(fs, "openSync").mockReturnValue(42 as unknown as number)
    const writeSpy = vi.spyOn(fs, "writeSync").mockReturnValue(1)
    const closeSpy = vi.spyOn(fs, "closeSync").mockReturnValue(undefined)

    const { showAd } = await import("../display.js")
    const handle = showAd("/dev/null", ad)
    const first = handle.vanish()
    const second = handle.vanish()

    expect(first.latencyMs).toBeGreaterThanOrEqual(0)
    expect(second.latencyMs).toBe(0)
    expect(closeSpy).toHaveBeenCalledTimes(1)
    expect(closeSpy).toHaveBeenCalledWith(42)

    openSpy.mockRestore()
    writeSpy.mockRestore()
    closeSpy.mockRestore()
  })

  it("throws when ttyPath cannot be opened", async () => {
    const openSpy = vi.spyOn(fs, "openSync").mockImplementation(() => {
      throw new Error("ENOENT")
    })

    const { showAd } = await import("../display.js")
    expect(() => showAd("/bogus/tty", ad)).toThrow(/ENOENT/)

    openSpy.mockRestore()
  })

  it("closes fd before re-throwing when the initial box write fails with non-EAGAIN", async () => {
    const openSpy = vi.spyOn(fs, "openSync").mockReturnValue(77 as unknown as number)
    const writeSpy = vi.spyOn(fs, "writeSync").mockImplementation(() => {
      throw new Error("EIO")
    })
    const closeSpy = vi.spyOn(fs, "closeSync").mockReturnValue(undefined)

    const { showAd } = await import("../display.js")
    expect(() => showAd("/dev/null", ad)).toThrow(/EIO/)
    expect(closeSpy).toHaveBeenCalledTimes(1)
    expect(closeSpy).toHaveBeenCalledWith(77)

    openSpy.mockRestore()
    writeSpy.mockRestore()
    closeSpy.mockRestore()
  })
})

describe("showAd — scroll region anchoring", () => {
  it("emits DECSTBM scroll-region + bottom placement on show", async () => {
    const openSpy = vi.spyOn(fs, "openSync").mockReturnValue(42 as unknown as number)
    const writes: string[] = []
    const writeSpy = vi.spyOn(fs, "writeSync").mockImplementation((_fd, data) => {
      writes.push(String(data))
      return 1
    })
    const closeSpy = vi.spyOn(fs, "closeSync").mockReturnValue(undefined)

    const { showAd } = await import("../display.js")
    showAd("/dev/null", ad)

    // WriteStream on fd=42 is not a real tty → readTtyDimensions falls back
    // to 24 rows × 80 cols. adHeight is determined by renderBox output; with
    // defaults the box is typically 10 lines so scrollBottom = 14.
    const showWrite = writes.join("")
    expect(showWrite).toContain("\x1b7") // save cursor
    expect(showWrite).toMatch(/\x1b\[1;\d+r/) // set scroll region
    expect(showWrite).toMatch(/\x1b\[\d+;1H/) // move to bottom pane
    expect(showWrite).toContain("\x1b[0J") // erase to end of screen
    expect(showWrite).toContain("\x1b8") // restore cursor

    openSpy.mockRestore()
    writeSpy.mockRestore()
    closeSpy.mockRestore()
  })

  it("emits reset-scroll-region + clear on vanish", async () => {
    const openSpy = vi.spyOn(fs, "openSync").mockReturnValue(42 as unknown as number)
    const writes: string[] = []
    const writeSpy = vi.spyOn(fs, "writeSync").mockImplementation((_fd, data) => {
      writes.push(String(data))
      return 1
    })
    const closeSpy = vi.spyOn(fs, "closeSync").mockReturnValue(undefined)

    const { showAd } = await import("../display.js")
    const handle = showAd("/dev/null", ad)
    writes.length = 0 // drop the show bytes; assert only on vanish
    handle.vanish()

    const vanishWrite = writes.join("")
    expect(vanishWrite).toContain("\x1b7") // save cursor
    expect(vanishWrite).toContain("\x1b[r") // reset scroll region
    expect(vanishWrite).toMatch(/\x1b\[\d+;1H/) // move to bottom pane
    expect(vanishWrite).toContain("\x1b[0J") // clear ad pane
    expect(vanishWrite).toContain("\x1b8") // restore cursor

    openSpy.mockRestore()
    writeSpy.mockRestore()
    closeSpy.mockRestore()
  })
})
