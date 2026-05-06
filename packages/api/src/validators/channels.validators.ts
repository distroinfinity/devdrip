import { ValidationError } from "../errors/index.js"
import { requireBody } from "./common.js"
import type { ChannelKey } from "@distrotv/shared"
import { CHANNEL_KEYS } from "../services/channel.service.js"

export interface PutChannelsInput {
  channels: { key: ChannelKey; subscribed: boolean; priority: number }[]
}

export function validatePutChannels(body: unknown): PutChannelsInput {
  const b = requireBody(body)
  const arr = b["channels"]
  if (!Array.isArray(arr)) throw new ValidationError("invalid_channels")

  const seen = new Set<string>()
  const out: PutChannelsInput["channels"] = []
  for (const item of arr) {
    if (typeof item !== "object" || item === null) throw new ValidationError("invalid_channel_item")
    const o = item as Record<string, unknown>
    const key = o["key"]
    if (typeof key !== "string" || !CHANNEL_KEYS.includes(key as ChannelKey)) {
      throw new ValidationError("invalid_channel_key")
    }
    if (seen.has(key)) throw new ValidationError("duplicate_channel_key")
    seen.add(key)
    if (typeof o["subscribed"] !== "boolean") throw new ValidationError("invalid_subscribed")
    const priority = o["priority"]
    if (
      typeof priority !== "number" ||
      !Number.isInteger(priority) ||
      priority < 0 ||
      priority > 99
    ) {
      throw new ValidationError("invalid_priority")
    }
    out.push({ key: key as ChannelKey, subscribed: o["subscribed"], priority })
  }
  return { channels: out }
}
