import { ValidationError } from "../errors/index.js"
import { requireBody } from "./common.js"
import type { ChannelKey } from "@distrotv/shared"
import { CHANNEL_KEYS } from "../services/channel.service.js"

// PUT /me/channels is a full replacement: the array IS the subscribed set, in
// priority order (index 0 = top). Server assigns priority — clients cannot.
export interface PutChannelsInput {
  channels: ChannelKey[]
}

export function validatePutChannels(body: unknown): PutChannelsInput {
  const b = requireBody(body)
  const arr = b["channels"]
  if (!Array.isArray(arr)) throw new ValidationError("invalid_channels")
  // zero subscriptions means no slot content; reject explicitly so the user
  // sees a clear error instead of silent demo-content fallback in the cli
  if (arr.length === 0) throw new ValidationError("at_least_one_channel_required")

  const seen = new Set<string>()
  const out: ChannelKey[] = []
  for (const item of arr) {
    if (typeof item !== "string" || !CHANNEL_KEYS.includes(item as ChannelKey)) {
      throw new ValidationError("invalid_channel_key")
    }
    if (seen.has(item)) throw new ValidationError("duplicate_channel_key")
    seen.add(item)
    out.push(item as ChannelKey)
  }
  return { channels: out }
}
