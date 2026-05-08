import type { SlotPayload } from "@distrotv/shared"
import { apiFetch } from "./api-client.js"

interface NowPlayingPayload {
  kind: "news" | "ticker" | "alert"
  payload: SlotPayload
  startedAt: string
  endsAt: string
}

// fire-and-forget. UX must not block on this.
export async function writeNowPlaying(deviceId: string, payload: NowPlayingPayload): Promise<void> {
  try {
    await apiFetch(`/me/devices/${deviceId}/now`, {
      method: "PUT",
      body: payload,
    })
  } catch {
    // ignore
  }
}

export async function clearNowPlaying(deviceId: string): Promise<void> {
  try {
    await apiFetch(`/me/devices/${deviceId}/now`, { method: "DELETE" })
  } catch {
    // ignore
  }
}
