"use server"

import { apiFetchOrRefresh } from "@/lib/api"
import type { ChannelDto } from "@distrotv/shared"

export async function saveChannelsFromSetup(
  updates: { key: ChannelDto["key"]; subscribed: boolean; priority: number }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await apiFetchOrRefresh("/me/channels", "/setup/channels", {
      method: "PUT",
      body: JSON.stringify({ channels: updates }),
      headers: { "Content-Type": "application/json" },
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "save_failed" }
  }
}
