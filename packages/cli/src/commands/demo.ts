import { Command } from "commander"
import { apiFetch, ApiError, NotAuthenticatedError, reportError } from "../lib/api-client.js"
import { detectColor, dim, green, yellow } from "../lib/ansi.js"
import { readConfig } from "../lib/config.js"
import { processByteChunk, type KeyAction } from "../lib/daemon/input.js"
import { DEMO_ADS } from "../lib/ad-cache-fixtures.js"
import { renderBox } from "../lib/render-box.js"

interface AdNextResponse {
  ad: {
    id: string
    campaign_id: string
    format: "text" | "banner" | "sponsored-link"
    headline: string
    body?: string
    url: string
    display_time_ms: number
    delivery_token: string
  }
}

interface DemoAd {
  headline: string
  body?: string
  url: string
}

async function pickAd(deviceId: string): Promise<DemoAd> {
  try {
    const body = await apiFetch<AdNextResponse | Record<string, unknown>>("/ads/next", {
      query: { surface: "terminal-tv", deviceId },
    })
    if ("ad" in body && body.ad) {
      const a = (body as AdNextResponse).ad
      return { headline: a.headline, body: a.body, url: a.url }
    }
  } catch (err) {
    // network / auth issues: fall through to the bundled fixture so the
    // preview is still useful offline. NotAuthenticatedError is re-thrown so
    // demo still behaves like init's pre-auth guard.
    if (err instanceof NotAuthenticatedError) throw err
    if (err instanceof ApiError) {
      // 4xx/5xx: fall through
    } else if (err instanceof TypeError && /fetch/i.test(err.message)) {
      // connection refused: fall through
    } else {
      throw err
    }
  }
  const fixture = DEMO_ADS[0]
  if (!fixture) {
    // unreachable — DEMO_ADS is a non-empty constant at module scope
    return { headline: "DevDrip demo", body: undefined, url: "https://devdrip.sh" }
  }
  return { headline: fixture.headline, body: fixture.body, url: fixture.url }
}

interface PracticeOutcome {
  vanishMs: number // dismiss keypress → post-cleanup (the number the <200ms rule bounds)
  actions: KeyAction[]
}

function runKeyPractice(onAction: (a: KeyAction) => void): Promise<PracticeOutcome> {
  return new Promise((resolve) => {
    const actions: KeyAction[] = []
    const stdin = process.stdin
    const wasRaw = stdin.isRaw
    try {
      stdin.setRawMode(true)
    } catch {
      // non-tty — the caller should have guarded; resolve immediately so we
      // don't leave the caller hanging.
      resolve({ vanishMs: 0, actions })
      return
    }
    stdin.resume()
    const onData = (chunk: Buffer): void => {
      const action = processByteChunk(chunk)
      if (!action) return
      if (action === "dismiss") {
        // Measure dismiss→cleanup specifically, not wall-clock: the <200 ms
        // hard rule governs "time from keypress to box gone", which in the
        // real daemon is the cleanup path (stop key-capture, redraw prompt).
        // Wall-clock would include practice time and wouldn't validate anything.
        const keyAt = Date.now()
        cleanup()
        resolve({ vanishMs: Date.now() - keyAt, actions })
        return
      }
      actions.push(action)
      onAction(action)
    }
    const cleanup = (): void => {
      stdin.off("data", onData)
      try {
        stdin.setRawMode(wasRaw)
      } catch {
        /* ignore */
      }
      stdin.pause()
    }
    stdin.on("data", onData)
  })
}

export async function runDemo(opts: { ascii?: boolean } = {}): Promise<void> {
  const cfg = await readConfig()
  if (!cfg) throw new NotAuthenticatedError("not signed in — run `devdrip auth` or `devdrip init`")

  const deviceId = cfg.device?.id
  if (!deviceId) {
    throw new Error("device not registered — run `devdrip init`")
  }

  const ad = await pickAd(deviceId)
  const color = detectColor()
  const ascii = opts.ascii ?? false

  console.log(
    renderBox(ad, { includeUrl: true, demoBadge: true, ...(ascii ? { ascii: true } : {}) })
  )
  console.log(`  ${dim("[D] discover · [S] skip · [K] kill · [M] mute · [Enter] dismiss", color)}`)

  // non-tty (CI, piped) — just print the box and exit, no key loop to hang on
  if (!process.stdin.isTTY || ascii) {
    console.log(`  ${dim("(run in an interactive terminal to practice keys)", color)}`)
    return
  }

  const outcome = await runKeyPractice((action) => {
    const msg =
      action === "discover" ? `would open: ${ad.url}` : `${action} (demo — no real effect)`
    process.stdout.write(`  ${yellow("✓", color)} ${msg}\n`)
  })

  const hitTarget = outcome.vanishMs < 200
  const mark = hitTarget ? green("✓", color) : yellow("!", color)
  console.log(`\n${mark} dismiss → vanish: ${outcome.vanishMs} ms (target <200 ms)`)
  if (outcome.actions.length > 0) {
    console.log(dim(`  practiced: ${outcome.actions.join(", ")}`, color))
  }
}

export const demoCmd = new Command("demo")
  .description("fire a demo ad immediately")
  .option("--ascii", "force ASCII rendering + skip key practice (CI-friendly)")
  .action(async (opts: { ascii?: boolean }) => {
    try {
      await runDemo(opts)
    } catch (err) {
      reportError(err)
    }
  })
