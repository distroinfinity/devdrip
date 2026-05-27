import { describe, it, expect } from "vitest"
import { verifyStaged } from "../auto-update.js"

function fakeExec(map: Record<string, { code: number; stdout: string }>) {
  return async (_node: string, args: string[]) => {
    const key = args.includes("--version") ? "version" : "self-check"
    return map[key] ?? { code: 1, stdout: "" }
  }
}

describe("verifyStaged", () => {
  it("passes when --version matches and self-check exits 0", async () => {
    const ok = await verifyStaged("/staged", "0.2.11", {
      exec: fakeExec({
        version: { code: 0, stdout: "0.2.11\n" },
        "self-check": { code: 0, stdout: "" },
      }),
    })
    expect(ok).toBe(true)
  })
  it("fails when --version mismatches", async () => {
    const ok = await verifyStaged("/staged", "0.2.11", {
      exec: fakeExec({
        version: { code: 0, stdout: "0.2.10\n" },
        "self-check": { code: 0, stdout: "" },
      }),
    })
    expect(ok).toBe(false)
  })
  it("fails when self-check exits non-zero", async () => {
    const ok = await verifyStaged("/staged", "0.2.11", {
      exec: fakeExec({
        version: { code: 0, stdout: "0.2.11\n" },
        "self-check": { code: 1, stdout: "" },
      }),
    })
    expect(ok).toBe(false)
  })
})
