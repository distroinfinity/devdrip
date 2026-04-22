import { describe, it, expect } from "vitest"
import { byteToAction } from "../input.js"

describe("byteToAction", () => {
  it.each([
    ["d", "discover"],
    ["D", "discover"],
    ["s", "skip"],
    ["S", "skip"],
    ["k", "kill"],
    ["K", "kill"],
    ["m", "mute"],
    ["M", "mute"],
    ["\r", "dismiss"],
    ["\n", "dismiss"],
    [" ", "dismiss"],
    ["\x1b", "dismiss"],
    ["\x03", "dismiss"],
  ])("maps %j → %s", (input, expected) => {
    expect(byteToAction(input)).toBe(expected)
  })

  it.each(["a", "b", "x", "1", "?"])("returns null for unmapped byte %j", (input) => {
    expect(byteToAction(input)).toBeNull()
  })
})
