import { randomBytes } from "node:crypto"
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { ChannelMode, type SlotPayload } from "@distrotv/shared"
import { apiFetch as defaultApiFetch } from "./api-client.js"
import { DEMO_SLOTS } from "./slot-cache-fixtures.js"
import { configDir } from "./config.js"

const RATIO_PATTERNS: Record<ChannelMode, ("news" | "ticker")[]> = {
  [ChannelMode.NewsOnly]: ["news"],
  [ChannelMode.NewsHeavy]: ["news", "news", "news", "ticker"],
  [ChannelMode.Balanced]: ["news", "ticker"],
  [ChannelMode.TickerHeavy]: ["news", "ticker", "ticker", "ticker"],
  [ChannelMode.TickerOnly]: ["ticker"],
}

export function pickKind(mode: ChannelMode, slotIndex: number): "news" | "ticker" {
  const pattern = RATIO_PATTERNS[mode]
  return pattern[slotIndex % pattern.length] ?? "news"
}

// in-memory slot counter — resets on daemon restart (acceptable for v1).
// persisting to ledger is deferred; ledger schema would need a kv_store table.
let _slotIndex = 0

export function nextSlotIndex(): number {
  return _slotIndex++
}

export function resetSlotIndex(): void {
  _slotIndex = 0
}

const CACHE_TTL_MS = 8 * 60 * 1000
const REFRESH_THRESHOLD = 3
const BATCH_SIZE = 10
// Bumped to 3: cache now stores SlotPayload (discriminated union), not just CachedAd.
// Old "ad-cache.json" (version 2) will fail the check and be silently dropped.
const CACHE_FILE_VERSION = 3

export type CachedSlot = SlotPayload & { cacheSource: "api" | "demo" }

interface CacheFile {
  version: 3
  userId: string
  deviceId: string
  surface: string
  fetchedAt: number
  expiresAt: number
  slots: CachedSlot[]
}

export interface SlotCache {
  next(): CachedSlot | null
  count(): number
  refreshNow(): Promise<void>
  close(): void
}

export function slotCachePath(): string {
  return join(configDir(), "slot-cache.json")
}

type ApiFetch = typeof defaultApiFetch

export interface SlotCacheDeps {
  apiFetch?: ApiFetch
  userId: string
  deviceId: string
  surface: "terminal-tv"
  now?: () => number
}

// Server returns { items: SlotPayload[] } from /me/content/next.
// SlotPayload is already camelCase (no field-shape transform needed).
interface ContentResponse {
  items?: SlotPayload[]
}

function readCacheFile(identity: {
  userId: string
  deviceId: string
  surface: string
}): CacheFile | null {
  try {
    const raw = readFileSync(slotCachePath(), "utf8")
    const parsed = JSON.parse(raw) as CacheFile
    if (parsed?.version !== CACHE_FILE_VERSION) return null
    if (
      parsed.userId !== identity.userId ||
      parsed.deviceId !== identity.deviceId ||
      parsed.surface !== identity.surface
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeCacheFile(data: CacheFile): void {
  const dir = configDir()
  const target = slotCachePath()
  const tmp = join(dir, `.slot-cache.${randomBytes(6).toString("hex")}.tmp`)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 })
  renameSync(tmp, target)
  try {
    chmodSync(target, 0o600)
  } catch {
    // non-fatal
  }
}

function emptyCache(identity: { userId: string; deviceId: string; surface: string }): CacheFile {
  return {
    version: CACHE_FILE_VERSION,
    userId: identity.userId,
    deviceId: identity.deviceId,
    surface: identity.surface,
    fetchedAt: 0,
    expiresAt: 0,
    slots: [],
  }
}

function demoCache(
  identity: { userId: string; deviceId: string; surface: string },
  nowMs: number
): CacheFile {
  return {
    version: CACHE_FILE_VERSION,
    userId: identity.userId,
    deviceId: identity.deviceId,
    surface: identity.surface,
    fetchedAt: nowMs,
    expiresAt: nowMs + CACHE_TTL_MS,
    slots: DEMO_SLOTS.map((s) => ({ ...s })),
  }
}

export function openSlotCache(deps: SlotCacheDeps): SlotCache {
  if (!deps.userId) throw new Error("slot-cache: userId is required")
  if (!deps.deviceId) {
    throw new Error("slot-cache: deviceId is required (device not registered)")
  }

  const apiFetch = deps.apiFetch ?? defaultApiFetch
  const now = deps.now ?? (() => Date.now())
  const identity = { userId: deps.userId, deviceId: deps.deviceId, surface: deps.surface }
  let current: CacheFile = readCacheFile(identity) ?? emptyCache(identity)
  let refreshInFlight: Promise<void> | null = null

  const isExpired = (): boolean => current.expiresAt <= now()

  async function doRefresh(): Promise<void> {
    try {
      const resp = await apiFetch<ContentResponse>("/me/content/next", {
        query: { deviceId: deps.deviceId, n: BATCH_SIZE, surface: deps.surface },
      })
      const items = resp.items ?? []
      const slots: CachedSlot[] = items.map((s) => ({ ...s, cacheSource: "api" }))

      if (slots.length > 0) {
        current = {
          version: CACHE_FILE_VERSION,
          userId: identity.userId,
          deviceId: identity.deviceId,
          surface: identity.surface,
          fetchedAt: now(),
          expiresAt: now() + CACHE_TTL_MS,
          slots,
        }
        writeCacheFile(current)
        return
      }

      if (current.slots.length === 0) {
        current = demoCache(identity, now())
        writeCacheFile(current)
      }
    } catch (err) {
      console.warn(`warn: slot-cache refresh failed (${(err as Error).message})`)
      if (current.slots.length === 0) {
        current = demoCache(identity, now())
        try {
          writeCacheFile(current)
        } catch {
          // non-fatal
        }
      }
    }
  }

  function refresh(): Promise<void> {
    if (refreshInFlight) return refreshInFlight
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null
    })
    return refreshInFlight
  }

  function scheduleRefreshIfNeeded(): void {
    if (refreshInFlight) return
    if (current.slots.length < REFRESH_THRESHOLD || isExpired()) {
      void refresh()
    }
  }

  scheduleRefreshIfNeeded()

  return {
    next() {
      if (isExpired()) {
        current.slots = []
        current.expiresAt = 0
        scheduleRefreshIfNeeded()
        return null
      }
      const slot = current.slots.shift() ?? null
      if (slot !== null) {
        try {
          writeCacheFile(current)
        } catch (err) {
          console.warn(`warn: slot-cache persist failed (${(err as Error).message})`)
        }
      }
      if (current.slots.length < REFRESH_THRESHOLD) {
        scheduleRefreshIfNeeded()
      }
      return slot
    },
    count() {
      if (isExpired()) return 0
      return current.slots.length
    },
    refreshNow() {
      return refresh()
    },
    close() {
      // state is already persisted after each consume/refresh; nothing to do
    },
  }
}
