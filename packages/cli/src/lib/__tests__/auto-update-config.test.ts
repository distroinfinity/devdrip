import { describe, it, expect, afterEach } from "vitest"
import { autoUpdateEnabled } from "../auto-update-config.js"

afterEach(() => {
  delete process.env.DISTRO_NO_AUTOUPDATE
})

describe("autoUpdateEnabled", () => {
  it("defaults on", () => {
    expect(autoUpdateEnabled({ autoUpdate: undefined })).toBe(true)
  })
  it("env opts out", () => {
    process.env.DISTRO_NO_AUTOUPDATE = "1"
    expect(autoUpdateEnabled({ autoUpdate: undefined })).toBe(false)
  })
  it("config flag opts out", () => {
    expect(autoUpdateEnabled({ autoUpdate: false })).toBe(false)
  })
})
