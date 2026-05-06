import { Command } from "commander"
import { apiFetch, ApiError, NotAuthenticatedError, reportError } from "../lib/api-client.js"
import { detectColor, dim, green, yellow } from "../lib/ansi.js"
import { readConfig } from "../lib/config.js"
import { processByteChunk, type KeyAction } from "../lib/daemon/input.js"
import { renderNewsBox } from "../lib/render-box.js"
import type { SlotContent, NewsPayload } from "@distrotv/shared"

interface ContentResponse {
  items?: SlotContent[]
}

async function fetchOneSlot(deviceId: string): Promise<SlotContent | null> {
  try {
    const resp = await apiFetch<ContentResponse>("/me/content/next", {
      query: { deviceId, n: 1 },
    })
    return resp.items?.[0] ?? null
  } catch (err) {
    if (err instanceof NotAuthenticatedError) throw err
    if (err instanceof ApiError) return null
    if (err instanceof TypeError && /fetch/i.test(err.message)) return null
    throw err
  }
}

function fallbackNewsPayload(): NewsPayload {
  return {
    id: "demo-hn:1",
    source: "hn" as never, // matches NewsSource.HackerNews enum value
    headline: "Distro TV — news demo (offline)",
    url: "https://news.ycombinator.com",
    score: 0,
    ageSeconds: 0,
    displayTimeMs: 4000,
  }
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

async function runNewsDemoOnce(deviceId: string, opts: { ascii?: boolean }): Promise<void> {
  const slot = await fetchOneSlot(deviceId)
  const payload: NewsPayload = slot && slot.kind === "news" ? slot.payload : fallbackNewsPayload()

  const color = detectColor()
  const ascii = opts.ascii ?? false

  console.log(renderNewsBox(payload, { ...(ascii ? { ascii: true } : {}) }))
  console.log(
    `  ${dim("[D] open · [B] save · [S] skip · [K] kill · [M] mute · [Enter] dismiss", color)}`
  )

  if (!process.stdin.isTTY || ascii) {
    console.log(`  ${dim("(run in an interactive terminal to practice keys)", color)}`)
    return
  }

  const outcome = await runKeyPractice((action) => {
    const msg =
      action === "discover"
        ? `would open: ${payload.url}`
        : action === "save"
          ? `would save to reading list (demo — no real effect)`
          : `${action} (demo — no real effect)`
    process.stdout.write(`  ${yellow("✓", color)} ${msg}\n`)
  })

  const hitTarget = outcome.vanishMs < 200
  const mark = hitTarget ? green("✓", color) : yellow("!", color)
  console.log(`\n${mark} dismiss → vanish: ${outcome.vanishMs} ms (target <200 ms)`)
  if (outcome.actions.length > 0) {
    console.log(dim(`  practiced: ${outcome.actions.join(", ")}`, color))
  }
}

export async function runDemo(opts: { ascii?: boolean } = {}): Promise<void> {
  const cfg = await readConfig()
  if (!cfg) throw new NotAuthenticatedError("not signed in — run `distro auth` or `distro init`")

  const deviceId = cfg.device?.id
  if (!deviceId) {
    throw new Error("device not registered — run `distro init`")
  }

  await runNewsDemoOnce(deviceId, opts)
}

export const demoCmd = new Command("demo")
  .description("preview a news slot in your terminal")
  .option("--ascii", "force ASCII rendering + skip key practice (CI-friendly)")
  .action(async (opts: { ascii?: boolean }) => {
    try {
      await runDemo(opts)
    } catch (err) {
      reportError(err)
    }
  })
