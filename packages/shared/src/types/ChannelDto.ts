import type { ChannelKey } from "./news.js"

export interface ChannelDto {
  id: string
  key: ChannelKey
  label: string
  defaultOn: boolean
  // user's current state (only present on /me/channels — null on the public /channels list)
  subscribed?: boolean
  priority?: number
}
