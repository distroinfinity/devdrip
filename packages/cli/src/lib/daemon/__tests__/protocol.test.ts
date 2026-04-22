import { describe, it, expect } from "vitest"
import { parseWireEvent } from "../protocol.js"

describe("parseWireEvent", () => {
  it("parses idle-start with a tty path", () => {
    const got = parseWireEvent(
      JSON.stringify({ type: "idle-start", tty: "/dev/ttys003", pid: 42, ts: 1 })
    )
    expect(got).toEqual({ type: "idle-start", tty: "/dev/ttys003", pid: 42, ts: 1 })
  })

  it("parses idle-start with tty: null", () => {
    const got = parseWireEvent(JSON.stringify({ type: "idle-start", tty: null, pid: 42, ts: 1 }))
    expect(got).toEqual({ type: "idle-start", tty: null, pid: 42, ts: 1 })
  })

  it("parses idle-end", () => {
    const got = parseWireEvent(JSON.stringify({ type: "idle-end", ts: 2 }))
    expect(got).toEqual({ type: "idle-end", ts: 2 })
  })

  it("parses dismiss", () => {
    const got = parseWireEvent(JSON.stringify({ type: "dismiss", ts: 3 }))
    expect(got).toEqual({ type: "dismiss", ts: 3 })
  })

  it("parses kill (control event)", () => {
    const got = parseWireEvent(JSON.stringify({ type: "kill", ts: 4 }))
    expect(got).toEqual({ type: "kill", ts: 4 })
  })

  it("returns null for malformed JSON", () => {
    expect(parseWireEvent("{not json}")).toBeNull()
  })

  it("returns null for unknown event types", () => {
    expect(parseWireEvent(JSON.stringify({ type: "nope", ts: 1 }))).toBeNull()
  })

  it("returns null when required fields are missing", () => {
    // idle-start must carry tty (string | null) and ts; tty must be present even if null
    expect(parseWireEvent(JSON.stringify({ type: "idle-start", pid: 1, ts: 1 }))).toBeNull()
    expect(parseWireEvent(JSON.stringify({ type: "idle-end" }))).toBeNull()
  })

  it("rejects non-string tty", () => {
    expect(
      parseWireEvent(JSON.stringify({ type: "idle-start", tty: 123, pid: 1, ts: 1 }))
    ).toBeNull()
  })
})
