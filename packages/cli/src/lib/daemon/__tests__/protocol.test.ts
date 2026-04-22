import { describe, it, expect } from "vitest"
import { parseWireEvent } from "../protocol.js"

describe("parseWireEvent", () => {
  it("parses idle-start with a tty path", () => {
    const got = parseWireEvent(JSON.stringify({ type: "idle-start", tty: "/dev/ttys003" }))
    expect(got).toEqual({ type: "idle-start", tty: "/dev/ttys003" })
  })

  it("parses idle-start with tty: null", () => {
    const got = parseWireEvent(JSON.stringify({ type: "idle-start", tty: null }))
    expect(got).toEqual({ type: "idle-start", tty: null })
  })

  it("parses idle-end", () => {
    const got = parseWireEvent(JSON.stringify({ type: "idle-end" }))
    expect(got).toEqual({ type: "idle-end" })
  })

  it("parses dismiss", () => {
    const got = parseWireEvent(JSON.stringify({ type: "dismiss" }))
    expect(got).toEqual({ type: "dismiss" })
  })

  it("parses kill (control event)", () => {
    const got = parseWireEvent(JSON.stringify({ type: "kill" }))
    expect(got).toEqual({ type: "kill" })
  })

  it("tolerates (and ignores) legacy `pid` and `ts` fields on the wire", () => {
    // older hook binaries may still send pid + ts; parser strips them.
    const got = parseWireEvent(
      JSON.stringify({ type: "idle-start", tty: "/dev/ttys003", pid: 42, ts: 1 })
    )
    expect(got).toEqual({ type: "idle-start", tty: "/dev/ttys003" })
  })

  it("returns null for malformed JSON", () => {
    expect(parseWireEvent("{not json}")).toBeNull()
  })

  it("returns null for unknown event types", () => {
    expect(parseWireEvent(JSON.stringify({ type: "nope" }))).toBeNull()
  })

  it("idle-start requires the tty field to be present (string or null)", () => {
    expect(parseWireEvent(JSON.stringify({ type: "idle-start" }))).toBeNull()
  })

  it("rejects non-string tty", () => {
    expect(parseWireEvent(JSON.stringify({ type: "idle-start", tty: 123 }))).toBeNull()
  })

  it("parses session-start", () => {
    const ev = parseWireEvent(JSON.stringify({ type: "session-start" }))
    expect(ev).toEqual({ type: "session-start" })
  })
})
