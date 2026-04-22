import { describe, it, expect } from "vitest"
import { homedir } from "node:os"
import { DAEMON_SOCKET_PATH } from "../constants/index.js"

describe("DAEMON_SOCKET_PATH", () => {
  it("lives under the user's home dir (never /tmp by default)", () => {
    expect(DAEMON_SOCKET_PATH.startsWith(homedir())).toBe(true)
    expect(DAEMON_SOCKET_PATH.endsWith("/.devdrip/daemon.sock")).toBe(true)
  })
})
