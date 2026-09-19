import { Command } from "commander"
import { apiFetch, ApiError, NotAuthenticatedError, reportError } from "../lib/api-client.js"
import { detectColor, dim } from "../lib/ansi.js"
import { readConfig } from "../lib/config.js"
import { renderSlotLine } from "../lib/render-line.js"
import { cliVersion } from "../lib/device.js"
import type { SlotPayload } from "@distrotv/shared"

interface ContentResponse {
  items?: SlotPayload[]
}

async function fetchOneSlot(deviceId: string): Promise<SlotPayload | null> {
  try {
    const resp = await apiFetch<ContentResponse>("/me/content/next", {
      // v lets the server send a sponsored slot to a client that can draw one
      query: { deviceId, n: 1, v: cliVersion() },
    })
    return resp.items?.[0] ?? null
  } catch (err) {
    if (err instanceof NotAuthenticatedError) throw err
    if (err instanceof ApiError) return null
    if (err instanceof TypeError && /fetch/i.test(err.message)) return null
    throw err
  }
}

// what the default feed looks like when the api has nothing to send (offline, not paired)
function fallbackSponsoredSlot(): SlotPayload {
  return {
    kind: "sponsored",
    adId: "house:preview",
    source: "house",
    advertiser: "Distro TV",
    headline: "This is the slot. One line while your agent works. Gone when you type.",
    ctaText: "Learn more",
    displayUrl: "distrotv.xyz",
    clickUrl: "https://distrotv.xyz/advertisers",
    deliveryId: "00000000-0000-4000-8000-000000000000",
    cpmRate: 0,
  }
}

// prints the panel exactly as claude code's status line will show it. no key practice:
// the product has no key capture — the link is cmd/ctrl-clickable instead.
async function runPreviewOnce(deviceId: string, opts: { ascii?: boolean }): Promise<void> {
  const slot = (await fetchOneSlot(deviceId)) ?? fallbackSponsoredSlot()
  const color = opts.ascii ? "none" : detectColor()
  const width = Math.min(100, Math.max(60, (process.stdout.columns ?? 80) - 4))
  console.log("")
  console.log(renderSlotLine({ ...slot, cacheSource: "demo" }, color, width))
  console.log("")
  console.log(
    `  ${dim("this shows in your status line while your agent works, and clears when you type.", color)}`
  )
  if (slot.kind === "sponsored") {
    console.log(
      `  ${dim("cmd/ctrl-click the link to open it. `dtv preferences` changes what plays.", color)}`
    )
  }
}

export async function runDemo(opts: { ascii?: boolean } = {}): Promise<void> {
  const cfg = await readConfig()
  if (!cfg) throw new NotAuthenticatedError("not signed in — run `distro auth` or `distro init`")

  const deviceId = cfg.device?.id
  if (!deviceId) {
    throw new Error("device not registered — run `distro init`")
  }

  await runPreviewOnce(deviceId, opts)
}

export const demoCmd = new Command("demo")
  .description("preview the slot as it will appear in your status line")
  .option("--ascii", "plain text, no colour (CI-friendly)")
  .action(async (opts: { ascii?: boolean }) => {
    try {
      await runDemo(opts)
    } catch (err) {
      reportError(err)
    }
  })
