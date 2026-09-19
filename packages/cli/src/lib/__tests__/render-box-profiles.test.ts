// packages/cli/src/lib/__tests__/render-box-profiles.test.ts
import { describe, it, expect } from "vitest"
import { renderBox } from "../render-box.js"

const ad = {
  headline: "DigitalOcean — $200 Credit for 60 Days",
  body: "Get started building your next side project on simple, reliable cloud infrastructure. Free credit for new devs.",
  url: "https://do.co/devdrip",
}

describe("renderBox — profiles", () => {
  it("narrow ascii (50 cols) renders within width", () => {
    const out = renderBox(ad, { width: 50, ascii: true, progress: 0.25 })
    for (const line of out.split("\n")) {
      if (line.startsWith("+") || line.startsWith("|")) {
        expect([...line].length).toBeLessThanOrEqual(50)
      }
    }
    expect(out).toContain("[D]")
  })

  it("mid unicode (72 cols) renders within width", () => {
    const out = renderBox(ad, {
      width: 72,
      earningsUsdc: 0.0123,
      source: "Carbon",
      progress: 0.5,
    })
    for (const line of out.split("\n")) {
      if (line.startsWith("╔") || line.startsWith("║") || line.startsWith("╚")) {
        expect([...line].length).toBeLessThanOrEqual(72)
      }
    }
    expect(out).toContain("via Carbon")
    expect(out).toContain("$0.0123")
  })

  it("wide ascii (100 cols) renders within width", () => {
    const out = renderBox(ad, {
      width: 100,
      earningsUsdc: 1.2345,
      source: "Carbon",
      progress: 0.75,
      ascii: true,
    })
    for (const line of out.split("\n")) {
      if (line.startsWith("+") || line.startsWith("|")) {
        expect([...line].length).toBeLessThanOrEqual(100)
      }
    }
  })

  it("strips ANSI escapes from untrusted ad headline", () => {
    const evil = { headline: "safe\x1b[31mEVIL\x1b[0m", url: "https://x.test" }
    const out = renderBox(evil, { width: 80, ascii: true })
    expect(out).not.toContain("\x1b")
    // note: sanitizer strips ESC codes, leaving plain "safeEVIL" in body; we only assert ESC byte absent
  })
})
