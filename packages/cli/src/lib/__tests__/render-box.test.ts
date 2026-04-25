import { describe, it, expect } from "vitest"
import { renderBox } from "../render-box.js"

const sampleAd = {
  id: "ad-1",
  campaignId: "camp-1",
  format: "text" as const,
  headline: "Vercel — ship web apps that scale",
  body: "Deploy Next.js in seconds with zero config.",
  url: "https://vercel.com",
  displayTimeMs: 8000,
  deliveryToken: "dt",
}

describe("renderBox", () => {
  it("produces a unicode box with headline, body, url, and dismiss hint", () => {
    const out = renderBox(sampleAd, { source: "Carbon" })
    expect(out).toContain("DEV DRIP TV")
    expect(out).toContain("via Carbon")
    expect(out).toContain(sampleAd.headline)
    expect(out).toContain(sampleAd.body)
    expect(out).toContain("vercel.com")
    expect(out).toContain("press enter to dismiss")
    expect(out).toMatch(/╔|╗|╚|╝|║|═/)
  })

  it("uses ASCII fallback when ascii flag is set", () => {
    const out = renderBox(sampleAd, { source: "Carbon", ascii: true })
    expect(out).not.toMatch(/╔|╗|╚|╝|║|═/)
    expect(out).toMatch(/\+|-|\|/)
  })

  it("word-wraps long body text", () => {
    const longBody =
      "This is a much longer advertising body intended to exceed the default line width of 72 columns minus padding so that the renderer has to wrap onto multiple lines cleanly."
    const out = renderBox({ ...sampleAd, body: longBody }, { source: "Carbon" })
    const lines = out.split("\n").filter((l) => l.includes("║") || l.startsWith("|"))
    const longest = Math.max(...lines.map((l) => [...l].length))
    expect(longest).toBeLessThanOrEqual(72)
  })

  it("handles missing body gracefully", () => {
    const out = renderBox({ ...sampleAd, body: undefined }, { source: "Carbon" })
    expect(out).toContain(sampleAd.headline)
    expect(out).toContain("press enter to dismiss")
  })

  it("truncates single long words that exceed inner width", () => {
    const longWord = "A".repeat(200)
    const out = renderBox({ ...sampleAd, body: longWord }, { source: "Carbon" })
    const lines = out.split("\n")
    for (const l of lines) {
      expect([...l].length).toBeLessThanOrEqual(72)
    }
    expect(out).toContain("…")
  })

  it("emits long URLs on their own line, unwrapped, outside the box", () => {
    const longUrl = "https://" + "x".repeat(200) + ".example.com"
    const out = renderBox({ ...sampleAd, url: longUrl }, { source: "Carbon" })
    const lines = out.split("\n")
    // box lines must still be bounded
    const boxLines = lines.filter((l) => l.includes("║") || l.startsWith("|") || /^[╔╗╚╝+]/.test(l))
    for (const l of boxLines) {
      expect([...l].length).toBeLessThanOrEqual(72)
    }
    // url line exists below the box, full URL intact
    const urlLine = lines.find((l) => l.startsWith("→ "))
    expect(urlLine).toBeDefined()
    expect(urlLine).toContain(longUrl)
    expect(urlLine).not.toContain("…")
  })

  it("strips ANSI escapes and control characters from ad content", () => {
    const out = renderBox(
      {
        ...sampleAd,
        headline: "\u001b[31mAlert\u001b[0m",
        body: "line one\u0007\nline two",
        url: "https://example.com/\u001b[2Jdanger",
      },
      { source: "Carbon" }
    )

    expect(out).toContain("Alert")
    expect(out).not.toContain("\u001b[31m")
    expect(out).not.toContain("\u001b[2J")
    expect(out).not.toContain("\u0007")
  })
})
