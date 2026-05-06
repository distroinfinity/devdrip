import type { ChannelDto } from "@distrotv/shared"
import { apiFetch } from "./api-client.js"

export interface ChannelUpdate {
  key: ChannelDto["key"]
  subscribed: boolean
  priority: number
}

export async function getMyChannels(): Promise<ChannelDto[]> {
  const resp = await apiFetch<{ channels: ChannelDto[] }>("/me/channels")
  return resp.channels
}

export async function putMyChannels(updates: ChannelUpdate[]): Promise<ChannelDto[]> {
  const resp = await apiFetch<{ channels: ChannelDto[] }>("/me/channels", {
    method: "PUT",
    body: { channels: updates },
  })
  return resp.channels
}
