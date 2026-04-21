import { createInterface } from "node:readline/promises"
import { Command } from "commander"
import { apiFetch, ApiError, NotAuthenticatedError, reportError } from "../lib/api-client.js"
import { readConfig } from "../lib/config.js"
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

export async function runDemo(): Promise<void> {
  const cfg = await readConfig()
  if (!cfg) throw new NotAuthenticatedError("not signed in — run `devdrip auth` or `devdrip init`")

  const deviceId = cfg.device?.id
  if (!deviceId) {
    throw new Error("device not registered — run `devdrip init`")
  }

  // 204 returns ok=true with empty body — apiFetch returns {} cast to T, not an ApiError.
  // Check for presence of the ad field rather than catching a 204 error.
  let body: AdNextResponse | Record<string, never> = {}
  try {
    body = await apiFetch<AdNextResponse>(`/ads/next`, {
      query: { surface: "terminal-tv", deviceId },
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 204) {
      // defensive: handle the case where the API changes to return a 204 error
      body = {}
    } else {
      throw err
    }
  }

  if (!("ad" in body) || !body.ad) {
    console.log("no ads queued right now — try `devdrip demo` after your next Claude session")
    return
  }

  const ad = body.ad
  console.log(
    renderBox({ headline: ad.headline, body: ad.body, url: ad.url }, { source: "Carbon" })
  )

  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    try {
      await rl.question("")
    } finally {
      rl.close()
    }
  }
}

export const demoCmd = new Command("demo")
  .description("fire a demo ad immediately")
  .action(async () => {
    try {
      await runDemo()
    } catch (err) {
      reportError(err)
    }
  })
