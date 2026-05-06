import type { ChannelDto, ChannelKey } from "@distrotv/shared"
import { apiFetch } from "./api-client.js"

export async function getMyChannels(): Promise<ChannelDto[]> {
  const resp = await apiFetch<{ channels: ChannelDto[] }>("/me/channels")
  return resp.channels
}

// PUT body is the new subscribed set in priority order. Server assigns priority
// from the array index, so the order of `keys` IS the user's preference order.
export async function putMyChannels(keys: ChannelKey[]): Promise<ChannelDto[]> {
  const resp = await apiFetch<{ channels: ChannelDto[] }>("/me/channels", {
    method: "PUT",
    body: { channels: keys },
  })
  return resp.channels
}
