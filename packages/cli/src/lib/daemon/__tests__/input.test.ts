import { describe, it, expect } from "vitest"
import { byteToAction, processByteChunk } from "../input.js"

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
    ["b", "save"],
    ["B", "save"],
    ["\r", "dismiss"],
    ["\n", "dismiss"],
    [" ", "dismiss"],
    ["\x1b", "dismiss"],
    ["\x03", "dismiss"],
  ])("maps %j → %s", (input, expected) => {
    expect(byteToAction(input)).toBe(expected)
  })

  it.each(["a", "x", "1", "?"])("returns null for unmapped byte %j", (input) => {
    expect(byteToAction(input)).toBeNull()
  })
})

describe("processByteChunk", () => {
  it("maps a single action byte", () => {
    expect(processByteChunk(Buffer.from("d"))).toBe("discover")
    expect(processByteChunk(Buffer.from("S"))).toBe("skip")
    expect(processByteChunk(Buffer.from("k"))).toBe("kill")
    expect(processByteChunk(Buffer.from("M"))).toBe("mute")
    expect(processByteChunk(Buffer.from("\r"))).toBe("dismiss")
    expect(processByteChunk(Buffer.from("\x03"))).toBe("dismiss")
  })

  it("returns null for unmapped single byte (e.g. backspace 0x7f)", () => {
    expect(processByteChunk(Buffer.from([0x7f]))).toBeNull()
  })

  it("lone ESC (1-byte chunk) is dismiss — the user pressed Escape", () => {
    expect(processByteChunk(Buffer.from([0x1b]))).toBe("dismiss")
  })

  it("drops terminal focus-in control sequence `\\x1b[I` (was dismissing ads!)", () => {
    expect(processByteChunk(Buffer.from([0x1b, 0x5b, 0x49]))).toBeNull()
  })

  it("drops terminal focus-out control sequence `\\x1b[O`", () => {
    expect(processByteChunk(Buffer.from([0x1b, 0x5b, 0x4f]))).toBeNull()
  })

  it("drops arrow-key CSI sequences", () => {
    expect(processByteChunk(Buffer.from([0x1b, 0x5b, 0x41]))).toBeNull() // up
    expect(processByteChunk(Buffer.from([0x1b, 0x5b, 0x42]))).toBeNull() // down
    expect(processByteChunk(Buffer.from([0x1b, 0x5b, 0x43]))).toBeNull() // right
    expect(processByteChunk(Buffer.from([0x1b, 0x5b, 0x44]))).toBeNull() // left
  })

  it("drops SS3 function-key sequences (F1 = `\\x1bOP`)", () => {
    expect(processByteChunk(Buffer.from([0x1b, 0x4f, 0x50]))).toBeNull()
  })

  it("drops Alt+letter sequences (ESC + letter is Meta on macOS)", () => {
    expect(processByteChunk(Buffer.from([0x1b, 0x64]))).toBeNull() // Alt+d, not our 'd'
  })

  it("first mapped byte wins on paste / held key", () => {
    expect(processByteChunk(Buffer.from("ddd"))).toBe("discover")
  })

  it("ignores leading noise to find the first mapped byte", () => {
    expect(processByteChunk(Buffer.from("xd"))).toBe("discover")
  })
})
