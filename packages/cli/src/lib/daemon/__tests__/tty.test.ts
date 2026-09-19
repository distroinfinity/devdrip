import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const originalPlatform = process.platform

function setPlatform(p: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", { value: p, configurable: true })
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  setPlatform(originalPlatform)
  vi.restoreAllMocks()
})

describe("resolveTty on macOS", () => {
  it("returns /dev/<tty> from `ps -p <pid> -o tty=`", async () => {
    setPlatform("darwin")
    vi.doMock("node:child_process", () => ({
      execSync: vi.fn(() => "ttys003\n"),
    }))
    const { resolveTty } = await import("../tty.js")
    expect(resolveTty()).toBe("/dev/ttys003")
  })

  it("returns null when ps reports no tty (?/??)", async () => {
    setPlatform("darwin")
    vi.doMock("node:child_process", () => ({
      execSync: vi.fn(() => "??\n"),
    }))
    const { resolveTty } = await import("../tty.js")
    expect(resolveTty()).toBeNull()
  })

  it("returns null when ps throws", async () => {
    setPlatform("darwin")
    vi.doMock("node:child_process", () => ({
      execSync: vi.fn(() => {
        throw new Error("exec failed")
      }),
    }))
    const { resolveTty } = await import("../tty.js")
    expect(resolveTty()).toBeNull()
  })

  it("already-prefixed /dev paths pass through untouched", async () => {
    setPlatform("darwin")
    vi.doMock("node:child_process", () => ({
      execSync: vi.fn(() => "/dev/ttys010\n"),
    }))
    const { resolveTty } = await import("../tty.js")
    expect(resolveTty()).toBe("/dev/ttys010")
  })
})

describe("resolveTty on linux", () => {
  it("reads /proc/self/fd/<fd>", async () => {
    setPlatform("linux")
    vi.doMock("node:fs", async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-imports
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs")
      return {
        ...actual,
        openSync: vi.fn(() => 7),
        closeSync: vi.fn(),
        readlinkSync: vi.fn((p: string) => {
          if (p === "/proc/self/fd/7") return "/dev/pts/2"
          throw new Error("unexpected readlink: " + p)
        }),
      }
    })
    const { resolveTty } = await import("../tty.js")
    expect(resolveTty()).toBe("/dev/pts/2")
  })

  it("returns null when /dev/tty cannot be opened", async () => {
    setPlatform("linux")
    vi.doMock("node:fs", async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-imports
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs")
      return {
        ...actual,
        openSync: vi.fn(() => {
          throw new Error("ENXIO")
        }),
      }
    })
    const { resolveTty } = await import("../tty.js")
    expect(resolveTty()).toBeNull()
  })
})
