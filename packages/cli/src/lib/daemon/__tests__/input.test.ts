import { describe, it, expect } from "vitest"
import { letterToAction, processByteChunk } from "../input.js"

describe("letterToAction", () => {
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
    ["c", "chart"],
    ["C", "chart"],
  ])("maps %j → %s", (input, expected) => {
    expect(letterToAction(input)).toBe(expected)
  })

  it.each(["a", "x", "1", "?"])("returns null for non-action letter %j", (input) => {
    expect(letterToAction(input)).toBeNull()
  })
})

describe("processByteChunk", () => {
  it("maps Meta (Alt/Option) chords ESC+letter to actions", () => {
    expect(processByteChunk(Buffer.from([0x1b, 0x64]))).toBe("discover") // ⌥d
    expect(processByteChunk(Buffer.from([0x1b, 0x53]))).toBe("skip") // ⌥S
    expect(processByteChunk(Buffer.from([0x1b, 0x6b]))).toBe("kill") // ⌥k
    expect(processByteChunk(Buffer.from([0x1b, 0x6d]))).toBe("mute") // ⌥m
    expect(processByteChunk(Buffer.from([0x1b, 0x62]))).toBe("save") // ⌥b
    expect(processByteChunk(Buffer.from([0x1b, 0x63]))).toBe("chart") // ⌥c
  })

  it("ignores bare letters — they belong to Claude Code, not Distro", () => {
    expect(processByteChunk(Buffer.from("d"))).toBeNull()
    expect(processByteChunk(Buffer.from("S"))).toBeNull()
    expect(processByteChunk(Buffer.from("k"))).toBeNull()
    expect(processByteChunk(Buffer.from("hello"))).toBeNull()
  })

  it("ignores Enter / Space / Ctrl+C so Claude's prompt and interrupt work", () => {
    expect(processByteChunk(Buffer.from("\r"))).toBeNull()
    expect(processByteChunk(Buffer.from("\n"))).toBeNull()
    expect(processByteChunk(Buffer.from(" "))).toBeNull()
    expect(processByteChunk(Buffer.from([0x03]))).toBeNull()
  })

  it("ignores Meta + non-action letter (e.g. ⌥a)", () => {
    expect(processByteChunk(Buffer.from([0x1b, 0x61]))).toBeNull()
  })

  it("lone ESC (1-byte chunk) is dismiss — the user pressed Escape", () => {
    expect(processByteChunk(Buffer.from([0x1b]))).toBe("dismiss")
  })

  it("drops terminal focus control sequences `\\x1b[I` / `\\x1b[O`", () => {
    expect(processByteChunk(Buffer.from([0x1b, 0x5b, 0x49]))).toBeNull()
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
})
