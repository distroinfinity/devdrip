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
  it("produces a unicode box with headline, body, and action footer (URL opt-in)", () => {
    const out = renderBox(sampleAd, { source: "Carbon", includeUrl: true })
    expect(out).toContain("DEV DRIP TV")
    expect(out).toContain("via Carbon")
    expect(out).toContain(sampleAd.headline)
    expect(out).toContain(sampleAd.body)
    expect(out).toContain("vercel.com")
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

  it("does not emit the ad URL line by default (anchored pane can't risk overflow)", () => {
    const longUrl = "https://" + "x".repeat(200) + ".example.com"
    const out = renderBox({ ...sampleAd, url: longUrl }, { source: "Carbon" })
    const lines = out.split("\n")
    const boxLines = lines.filter((l) => l.includes("║") || l.startsWith("|") || /^[╔╗╚╝+]/.test(l))
    for (const l of boxLines) {
      expect([...l].length).toBeLessThanOrEqual(72)
    }
    expect(lines.find((l) => l.startsWith("→ "))).toBeUndefined()
  })

  it("emits the ad URL on its own line when includeUrl is opted in (preview/demo path)", () => {
    const longUrl = "https://" + "x".repeat(200) + ".example.com"
    const out = renderBox({ ...sampleAd, url: longUrl }, { source: "Carbon", includeUrl: true })
    const urlLine = out.split("\n").find((l) => l.startsWith("→ "))
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

describe("renderBox — extended options", () => {
  it("accepts width, earningsUsdc, progress without crashing", () => {
    const out = renderBox(
      { headline: "H", body: "B", url: "https://x.test" },
      { width: 80, earningsUsdc: 0.0423, progress: 0.5, ascii: true }
    )
    expect(typeof out).toBe("string")
    expect(out.length).toBeGreaterThan(0)
  })

  it("clamps width below 40 to 40", () => {
    const out = renderBox({ headline: "H", url: "https://x.test" }, { width: 20, ascii: true })
    const lines = out.split("\n")
    for (const line of lines) {
      if (line.startsWith("+") || line.startsWith("|")) {
        expect([...line].length).toBeLessThanOrEqual(40)
      }
    }
  })

  it("clamps width above 120 to 120", () => {
    const out = renderBox({ headline: "H", url: "https://x.test" }, { width: 500, ascii: true })
    const lines = out.split("\n")
    for (const line of lines) {
      if (line.startsWith("+") || line.startsWith("|")) {
        expect([...line].length).toBeLessThanOrEqual(120)
      }
    }
  })

  it("drops the right header segment when source/earnings would overflow at narrow width", () => {
    // PR review #3: long source segment + earnings + tight width caused the
    // header to grow past `width`, breaking box alignment. Right segment is
    // now dropped when fillLen<4.
    const out = renderBox(
      { headline: "H", url: "https://x.test" },
      {
        width: 40,
        ascii: true,
        earningsUsdc: 0.123456789,
        source: "very-long-source-name-that-overflows",
      }
    )
    const lines = out.split("\n")
    // header is the first line. its visible length must not exceed the clamped
    // width (40 — which is also the lower clamp).
    expect([...(lines[0] ?? "")].length).toBe(40)
  })
})

describe("renderBox — action footer", () => {
  it("includes [D] [S] [K] [M] action keys", () => {
    const out = renderBox({ headline: "H", url: "https://x.test" }, { width: 80, ascii: true })
    expect(out).toContain("[D]")
    expect(out).toContain("[S]")
    expect(out).toContain("[K]")
    expect(out).toContain("[M]")
    expect(out).toContain("discover")
    expect(out).toContain("skip")
  })

  it("drops 'press enter to dismiss' — superseded by action footer", () => {
    const out = renderBox({ headline: "H", url: "https://x.test" }, { width: 80, ascii: true })
    expect(out).not.toContain("press enter to dismiss")
  })
})

describe("renderBox — progress bar", () => {
  it("renders filled cells proportional to progress (unicode thin-track)", () => {
    const out = renderBox(
      { headline: "H", url: "https://x.test" },
      { width: 80, progress: 0.5, ascii: false, color: "none" }
    )
    // filled body + head + empty track: e.g. "━━━━━╸─────"
    expect(out).toMatch(/━+╸?─+/)
  })

  it("renders filled cells in ASCII mode (equals head bar)", () => {
    const out = renderBox(
      { headline: "H", url: "https://x.test" },
      { width: 80, progress: 0.5, ascii: true }
    )
    // ASCII: "=====>-----"
    expect(out).toMatch(/=+>?-+/)
  })

  it("omits progress row when progress is undefined", () => {
    const out = renderBox({ headline: "H", url: "https://x.test" }, { width: 80, ascii: true })
    expect(out).not.toMatch(/=+>-+/)
  })

  it("includes a verb prefix on the progress row in unicode mode", () => {
    const out = renderBox(
      { headline: "H", url: "https://x.test" },
      { width: 80, progress: 0.3, ascii: false, color: "none", elapsedMs: 0 }
    )
    expect(out).toMatch(/working/)
  })

  it("verb rotates with elapsed time", () => {
    const early = renderBox(
      { headline: "H", url: "https://x.test" },
      { width: 80, progress: 0.3, ascii: false, color: "none", elapsedMs: 0 }
    )
    const later = renderBox(
      { headline: "H", url: "https://x.test" },
      { width: 80, progress: 0.3, ascii: false, color: "none", elapsedMs: 5_000 }
    )
    expect(early).toMatch(/working/)
    expect(later).toMatch(/thinking/)
  })
})

describe("renderBox — earnings header", () => {
  it("includes formatted earnings in header when provided", () => {
    const out = renderBox(
      { headline: "H", url: "https://x.test" },
      { width: 80, earningsUsdc: 0.0423, ascii: true }
    )
    expect(out).toContain("$0.0423")
    expect(out).toContain("earned")
  })

  it("omits earnings segment when undefined", () => {
    const out = renderBox({ headline: "H", url: "https://x.test" }, { width: 80, ascii: true })
    expect(out).not.toContain("$")
    expect(out).not.toContain("earned")
  })

  it("includes source badge when provided", () => {
    const out = renderBox(
      { headline: "H", url: "https://x.test" },
      { width: 80, source: "Carbon", ascii: true }
    )
    expect(out).toContain("via Carbon")
  })
})
