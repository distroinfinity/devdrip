import { PostHog } from "posthog-node"
import { resolveRelease, scrubError, TELEMETRY_EVENTS } from "@distrotv/shared/telemetry"
import { readConfig, telemetryEnabled, type DevdripConfig } from "./config.js"
import { cliVersion } from "./device.js"
import { appendLog } from "./daemon/lifecycle.js"

let client: PostHog | null = null
let initialized = false

// distinct_id: anonymous device id, upgraded to user id when present.
function distinctId(cfg: DevdripConfig | null): string {
  return cfg?.user?.id ?? cfg?.device?.id ?? "cli:anon"
}

// Returns null when no baked key OR telemetry disabled by env/config.
// process.env.POSTHOG_CLI_KEY is replaced at build time by tsup `define`
// (dot-notation is required for the replacement to apply).
function getClient(cfg: DevdripConfig | null): PostHog | null {
  if (initialized) return client
  initialized = true
  const key = process.env.POSTHOG_CLI_KEY
  if (!key || !telemetryEnabled(cfg)) return null
  client = new PostHog(key, {
    host: process.env.POSTHOG_CLI_HOST ?? "https://us.i.posthog.com",
    flushAt: 1, // short-lived processes: flush eagerly
  })
  return client
}

export function captureCliException(err: unknown, command?: string): void {
  void (async () => {
    try {
      const cfg = await readConfig().catch(() => null)
      const ph = getClient(cfg)
      if (!ph) return
      const scrubbed = scrubError(err)
      ph.captureException(new Error(`${scrubbed.name}: ${scrubbed.message}`), distinctId(cfg), {
        surface: "cli",
        release: resolveRelease(cliVersion()),
        command,
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        cliVersion: cliVersion(),
        stack: scrubbed.stack,
      })
    } catch (e) {
      appendLog("warn", "cli telemetry capture failed", { error: String(e) })
    }
  })()
}

// Bounded flush — CLI commands must exit promptly even if the network hangs.
export async function flushCliTelemetry(timeoutMs = 1500): Promise<void> {
  if (!client) return
  await Promise.race([
    client._shutdown().catch(() => {}),
    new Promise<void>((r) => setTimeout(r, timeoutMs)),
  ])
}

export { TELEMETRY_EVENTS }
