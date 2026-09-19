import { describe, it, expect, afterEach } from "vitest"
import { homedir } from "node:os"
import { daemonSocketPath } from "../daemon-socket.js"

const originalHome = process.env["HOME"]

afterEach(() => {
  if (originalHome === undefined) delete process.env["HOME"]
  else process.env["HOME"] = originalHome
})

describe("daemonSocketPath", () => {
  it("returns a path under the current home dir", () => {
    const p = daemonSocketPath()
    expect(p.startsWith(homedir())).toBe(true)
    expect(p.endsWith("/.distro/daemon.sock")).toBe(true)
  })

  it("tracks changes to process.env.HOME (lazy eval)", () => {
    process.env["HOME"] = "/tmp/distro-test-home"
    expect(daemonSocketPath()).toBe("/tmp/distro-test-home/.distro/daemon.sock")
  })

  it("falls back to /tmp/distro-<uid>.sock when preferred path overflows sun_path", () => {
    // 150-char home dir puts the preferred path >104 bytes
    process.env["HOME"] = "/tmp/" + "x".repeat(140)
    const p = daemonSocketPath(1234)
    expect(p).toBe("/tmp/distro-1234.sock")
  })
})
