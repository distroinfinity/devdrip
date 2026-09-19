import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createDebounced } from "../debounce.js"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("createDebounced", () => {
  it("runs once after the quiet period, however many times it was poked", () => {
    const fn = vi.fn()
    const d = createDebounced(fn, 5_000)
    d.poke()
    vi.advanceTimersByTime(3_000)
    d.poke()
    vi.advanceTimersByTime(4_999)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })
  it("never waits longer than maxWait while pokes keep coming", () => {
    const fn = vi.fn()
    const d = createDebounced(fn, 5_000, 12_000)
    for (let t = 0; t < 12_000; t += 2_000) {
      d.poke()
      vi.advanceTimersByTime(2_000)
    }
    expect(fn).toHaveBeenCalledTimes(1)
  })
  it("cancel drops a pending run", () => {
    const fn = vi.fn()
    const d = createDebounced(fn, 5_000)
    d.poke()
    d.cancel()
    vi.advanceTimersByTime(10_000)
    expect(fn).not.toHaveBeenCalled()
  })
})
