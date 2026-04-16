import { logger } from "./logger.js"

const BEACON_TIMEOUT_MS = 3_000

// fire-and-forget HTTP GET to a tracking URL.
// never throws — failures are logged and swallowed.
export async function fireBeacon(url: string): Promise<void> {
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(BEACON_TIMEOUT_MS),
    })
    if (!response.ok) {
      logger.warn({ url, status: response.status }, "beacon returned non-OK status")
    }
  } catch (err) {
    logger.warn({ err, url }, "beacon fire failed")
  }
}
