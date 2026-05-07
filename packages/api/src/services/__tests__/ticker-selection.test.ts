import { describe, it, expect } from "vitest"

// duplicated rotation helper (the service exports nothing internal; test pins ordering invariants)
function deviceRotationIndex(deviceId: string, mod: number, minuteBucket: number): number {
  let h = 0
  for (let i = 0; i < deviceId.length; i++) h = (h * 31 + deviceId.charCodeAt(i)) | 0
  return Math.abs(h + minuteBucket) % mod
}

describe("ticker rotation", () => {
  it("returns a stable index for the same minute bucket and device", () => {
    const a = deviceRotationIndex("device-a", 5, 100)
    const b = deviceRotationIndex("device-a", 5, 100)
    expect(a).toBe(b)
  })

  it("steps the index when the minute bucket advances", () => {
    const at100 = deviceRotationIndex("device-a", 5, 100)
    const at101 = deviceRotationIndex("device-a", 5, 101)
    expect(at100).not.toBe(at101)
  })

  it("returns indices within bounds for any input", () => {
    for (const dev of ["a", "abcdef", "longer-device-id-string"]) {
      for (const mod of [1, 3, 5, 25]) {
        const idx = deviceRotationIndex(dev, mod, 12345)
        expect(idx).toBeGreaterThanOrEqual(0)
        expect(idx).toBeLessThan(mod)
      }
    }
  })
})
