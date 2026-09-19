import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runSelfCheck } from "../self-check.js"

// configDir() resolves via homedir() which reads HOME on Unix — override HOME
// to a temp dir so the test doesn't touch the developer's ~/.distro ledger.
let tempHome: string
let origHome: string | undefined

beforeEach(() => {
  origHome = process.env["HOME"]
  tempHome = mkdtempSync(join(tmpdir(), "distro-self-check-test-"))
  process.env["HOME"] = tempHome
})

afterEach(() => {
  if (origHome !== undefined) {
    process.env["HOME"] = origHome
  } else {
    delete process.env["HOME"]
  }
  rmSync(tempHome, { recursive: true, force: true })
})

describe("runSelfCheck", () => {
  it("returns 0 when the ledger opens", async () => {
    expect(await runSelfCheck()).toBe(0)
  })
})
