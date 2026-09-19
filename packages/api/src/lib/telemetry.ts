import { PostHog } from "posthog-node"
import { resolveRelease, scrubError } from "@distrotv/shared/telemetry"
import { env } from "../config/env.js"
import { logger } from "./logger.js"

// One long-lived client; null when no key (silent no-op everywhere).
let client: PostHog | null = null

function getClient(): PostHog | null {
  if (client) return client
  if (!env.posthogKey) return null
  client = new PostHog(env.posthogKey, {
    host: env.posthogHost,
    flushAt: 20,
    flushInterval: 10_000,
  })
  return client
}

export interface ApiErrorContext {
  userId?: string
  route?: string
  method?: string
  statusCode?: number
}

export function captureApiException(err: unknown, ctx: ApiErrorContext = {}): void {
  const ph = getClient()
  if (!ph) return
  try {
    const scrubbed = scrubError(err)
    const distinctId = ctx.userId ?? "api:system"
    ph.captureException(new Error(`${scrubbed.name}: ${scrubbed.message}`), distinctId, {
      service: "api",
      release: resolveRelease(),
      route: ctx.route,
      method: ctx.method,
      statusCode: ctx.statusCode,
      stack: scrubbed.stack,
    })
  } catch (e) {
    logger.warn({ err: String(e) }, "posthog captureException failed (swallowed)")
  }
}

// Bounded flush for shutdown — never let a slow network hang termination.
// posthog-node v5 exposes _shutdown() (no public shutdown() alias).
export async function flushTelemetry(timeoutMs = 2000): Promise<void> {
  const ph = getClient()
  if (!ph) return
  await Promise.race([
    ph._shutdown().catch(() => {}),
    new Promise<void>((r) => setTimeout(r, timeoutMs)),
  ])
}
