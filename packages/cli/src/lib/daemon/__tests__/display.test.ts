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
