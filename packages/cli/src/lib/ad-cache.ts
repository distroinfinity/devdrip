import { randomBytes } from "node:crypto"
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { ServedAdPayload } from "@devdrip/shared"
import { apiFetch as defaultApiFetch } from "./api-client.js"
import { DEMO_ADS } from "./ad-cache-fixtures.js"
import { configDir } from "./config.js"

// Delivery tokens are minted with a 10m TTL (packages/api/src/lib/ad-delivery.ts).
// We refresh at 8m so in-flight ads never carry a token stale enough to be
// rejected at sync.
const CACHE_TTL_MS = 8 * 60 * 1000
const REFRESH_THRESHOLD = 3
const BATCH_SIZE = 10
const CACHE_FILE_VERSION = 1

export interface CachedAd extends ServedAdPayload {
  cacheSource: "api" | "demo"
}

interface CacheFile {
  version: 1
  fetchedAt: number
  expiresAt: number
  ads: CachedAd[]
}

export interface AdCache {
  next(): CachedAd | null
  count(): number
  refreshNow(): Promise<void>
  close(): void
}

export function adCachePath(): string {
  return join(configDir(), "ad-cache.json")
}

type ApiFetch = typeof defaultApiFetch

export interface AdCacheDeps {
  apiFetch?: ApiFetch
  deviceId: string
  surface: "terminal-tv"
  now?: () => number
}

interface BatchResponseAd {
  id: string
  campaign_id: string
  format: "text" | "banner" | "sponsored-link"
  headline: string
  body?: string
  url: string
  display_time_ms: number
  delivery_token: string
  impression_beacon_url?: string | null
  click_tracking_url?: string | null
}

function toCachedAd(a: BatchResponseAd): CachedAd {
  return {
    id: a.id,
    campaignId: a.campaign_id,
    format: a.format,
    headline: a.headline,
    body: a.body,
    url: a.url,
    displayTimeMs: a.display_time_ms,
    deliveryToken: a.delivery_token,
    impressionBeaconUrl: a.impression_beacon_url ?? undefined,
    clickTrackingUrl: a.click_tracking_url ?? undefined,
    cacheSource: "api",
  }
}

function readCacheFile(): CacheFile | null {
  try {
    const raw = readFileSync(adCachePath(), "utf8")
    const parsed = JSON.parse(raw) as CacheFile
    if (parsed?.version !== CACHE_FILE_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

function writeCacheFile(data: CacheFile): void {
  const dir = configDir()
  const target = adCachePath()
  const tmp = join(dir, `.ad-cache.${randomBytes(6).toString("hex")}.tmp`)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 })
  renameSync(tmp, target)
  try {
    chmodSync(target, 0o600)
  } catch {
    // non-fatal: some filesystems don't honor chmod
  }
}

function emptyCache(): CacheFile {
  return { version: CACHE_FILE_VERSION, fetchedAt: 0, expiresAt: 0, ads: [] }
}

function demoCache(nowMs: number): CacheFile {
  return {
    version: CACHE_FILE_VERSION,
    fetchedAt: nowMs,
    expiresAt: nowMs + CACHE_TTL_MS,
    ads: DEMO_ADS.map((a) => ({ ...a })),
  }
}

export function openAdCache(deps: AdCacheDeps): AdCache {
  const apiFetch = deps.apiFetch ?? defaultApiFetch
  const now = deps.now ?? (() => Date.now())
  let current: CacheFile = readCacheFile() ?? emptyCache()
  let refreshInFlight: Promise<void> | null = null

  const isExpired = (): boolean => current.expiresAt <= now()

  async function doRefresh(): Promise<void> {
    try {
      const resp = await apiFetch<{ ads?: BatchResponseAd[] } | Record<string, unknown>>(
        "/ads/batch",
        { query: { deviceId: deps.deviceId, surface: deps.surface, count: BATCH_SIZE } }
      )
      const rawAds = "ads" in resp && Array.isArray(resp.ads) ? (resp.ads as BatchResponseAd[]) : []
      const ads = rawAds.map(toCachedAd)

      if (ads.length > 0) {
        current = {
          version: CACHE_FILE_VERSION,
          fetchedAt: now(),
          expiresAt: now() + CACHE_TTL_MS,
          ads,
        }
        writeCacheFile(current)
        return
      }

      // 204 / empty: keep prior cache if non-empty, else fall back to demos
      if (current.ads.length === 0) {
        current = demoCache(now())
        writeCacheFile(current)
      }
    } catch (err) {
      console.warn(`warn: ad-cache refresh failed (${(err as Error).message})`)
      if (current.ads.length === 0) {
        current = demoCache(now())
        try {
          writeCacheFile(current)
        } catch {
          // non-fatal — keep the in-memory demo cache, caller continues
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
    if (current.ads.length < REFRESH_THRESHOLD || isExpired()) {
      void refresh()
    }
  }

  // warm the cache in the background so the first consumer doesn't wait on I/O
  scheduleRefreshIfNeeded()

  return {
    next() {
      if (isExpired()) {
        // stale tokens — drop what we have and trigger refresh. The caller gets
        // null this call; a follow-up call after refresh completes will succeed.
        current.ads = []
        current.expiresAt = 0
        scheduleRefreshIfNeeded()
        return null
      }
      const ad = current.ads.shift() ?? null
      if (ad !== null) {
        try {
          writeCacheFile(current)
        } catch {
          // non-fatal: worst case the consumed ad re-appears after restart and
          // the backend dedupes on client-generated impression ids at sync.
        }
      }
      if (current.ads.length < REFRESH_THRESHOLD) {
        scheduleRefreshIfNeeded()
      }
      return ad
    },
    count() {
      if (isExpired()) return 0
      return current.ads.length
    },
    refreshNow() {
      return refresh()
    },
    close() {
      // state is already persisted after each consume/refresh; nothing to do
    },
  }
}
