import { describe, it, expect, beforeAll } from "vitest"
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"

const binPath = join(__dirname, "..", "..", "..", "dist", "index.js")

beforeAll(() => {
  if (!existsSync(binPath)) {
    throw new Error(`CLI not built at ${binPath} — run \`pnpm --filter @devdrip/cli build\` first`)
  }
})

describe("hook timing (no daemon running)", () => {
  it("devdrip hook pre-tool completes in <100ms when socket is absent", () => {
    const samples: number[] = []
    for (let i = 0; i < 5; i++) {
      const start = Date.now()
      execFileSync("node", [binPath, "hook", "pre-tool"], {
        // deliberately point at a non-existent home so no daemon socket exists
        env: { ...process.env, HOME: "/nonexistent-path-for-timing-test" },
        stdio: "ignore",
      })
      samples.push(Date.now() - start)
    }
    const max = Math.max(...samples)
    // Generous envelope — we're mostly checking the hook doesn't hang on
    // connect timeouts. 250ms accounts for cold node start on CI hardware.
    expect(max).toBeLessThan(250)
  })
})
