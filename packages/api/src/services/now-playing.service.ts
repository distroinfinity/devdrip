import { getRedis } from "../lib/redis.js"
import { nowPlayingKey, NOW_PLAYING_TTL_SEC } from "../lib/now-playing-keys.js"
import type { NowPlayingDto } from "@distrotv/shared"

interface StoredNowPlaying {
  kind: "news" | "ticker" | "alert"
  payload: unknown
  startedAt: string
  endsAt: string
}

export async function setNowPlaying(deviceId: string, payload: StoredNowPlaying): Promise<void> {
  const redis = getRedis()
  await redis.set(nowPlayingKey(deviceId), payload, { ex: NOW_PLAYING_TTL_SEC })
}

export async function clearNowPlaying(deviceId: string): Promise<void> {
  const redis = getRedis()
  await redis.del(nowPlayingKey(deviceId))
}

export async function getNowPlaying(deviceId: string): Promise<NowPlayingDto> {
  const redis = getRedis()
  const stored = await redis.get<StoredNowPlaying>(nowPlayingKey(deviceId))
  if (!stored) return { active: null, next: null }
  return {
    active: {
      kind: stored.kind,
      payload: stored.payload,
      startedAt: stored.startedAt,
      endsAt: stored.endsAt,
    },
    next: null,
  }
}
